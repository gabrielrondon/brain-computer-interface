//! Multi-channel EEG processing pipeline orchestrating buffers, filters, and spectral estimation.

use crate::fft::{compute_psd, WindowFunction};
use crate::filters::biquad::{BiquadFilter, FilterChain};
use crate::metrics::{
    compute_band_powers, compute_cognitive_metrics, compute_relative_powers, evaluate_artifacts,
    ArtifactStatus, BandPowers, CognitiveMetrics, RelativeBandPowers,
};
use crate::ring_buffer::RingBuffer;

#[derive(Debug, Clone)]
pub struct ChannelState {
    pub raw_buffer: RingBuffer,
    pub filtered_buffer: RingBuffer,
    pub filter_chain: FilterChain,
}

#[derive(Debug, Clone)]
pub struct EegPipeline {
    pub sample_rate: f32,
    pub channels: Vec<ChannelState>,
    pub fft_size: usize,
    pub frontal_channel_indices: Vec<usize>,
}

impl EegPipeline {
    /// Creates a new multi-channel EEG processing pipeline.
    ///
    /// - `num_channels`: Number of acquisition electrodes (e.g. 4 for Muse: TP9, AF7, AF8, TP10).
    /// - `sample_rate`: Sampling frequency in Hertz (e.g. 256.0 Hz).
    /// - `buffer_capacity`: Maximum history stored per channel in ring buffer (e.g. 2048 samples).
    /// - `fft_size`: Window size for spectral estimation (must be power of two, e.g. 256).
    pub fn new(
        num_channels: usize,
        sample_rate: f32,
        buffer_capacity: usize,
        fft_size: usize,
    ) -> Self {
        assert!(num_channels > 0, "Pipeline must have at least 1 channel");
        assert!(fft_size.is_power_of_two(), "FFT size must be power of two");

        let mut channels = Vec::with_capacity(num_channels);

        for _ in 0..num_channels {
            let mut chain = FilterChain::new();
            // 1. DC Highpass rejection (0.5 Hz)
            chain.add_stage(BiquadFilter::highpass(sample_rate, 0.5));
            // 2. High-frequency cutoff Lowpass (45.0 Hz)
            chain.add_stage(BiquadFilter::lowpass(sample_rate, 45.0));
            // 3. Mains Notch 50 Hz (Europe / International)
            chain.add_stage(BiquadFilter::notch(sample_rate, 50.0, 10.0));
            // 4. Mains Notch 60 Hz (Americas)
            chain.add_stage(BiquadFilter::notch(sample_rate, 60.0, 10.0));

            channels.push(ChannelState {
                raw_buffer: RingBuffer::new(buffer_capacity),
                filtered_buffer: RingBuffer::new(buffer_capacity),
                filter_chain: chain,
            });
        }

        // By default, assume 4-channel layout with frontal channels at index 1 and 2 (AF7, AF8)
        let frontal = if num_channels >= 4 {
            vec![1, 2]
        } else {
            vec![0]
        };

        Self {
            sample_rate,
            channels,
            fft_size,
            frontal_channel_indices: frontal,
        }
    }

    /// Pushes a single raw sample into the specified channel and updates filtered stream.
    #[inline(always)]
    pub fn push_sample(&mut self, channel: usize, raw_sample: f32) -> f32 {
        if let Some(ch) = self.channels.get_mut(channel) {
            ch.raw_buffer.push(raw_sample);
            let filtered = ch.filter_chain.process(raw_sample);
            ch.filtered_buffer.push(filtered);
            filtered
        } else {
            0.0
        }
    }

    /// Pushes a block of contiguous samples into the specified channel.
    pub fn push_chunk(&mut self, channel: usize, samples: &[f32]) {
        for &s in samples {
            self.push_sample(channel, s);
        }
    }

    /// Extracts the latest `n` filtered samples for a given channel into `destination`.
    pub fn get_latest_filtered(&self, channel: usize, n: usize, destination: &mut [f32]) -> usize {
        if let Some(ch) = self.channels.get(channel) {
            ch.filtered_buffer.get_latest(n, destination)
        } else {
            0
        }
    }

    /// Computes Power Spectral Density for a specific channel using the latest `fft_size` window.
    pub fn get_psd(&self, channel: usize) -> Option<(Vec<f32>, Vec<f32>)> {
        let ch = self.channels.get(channel)?;
        let mut window = vec![0.0; self.fft_size];
        let read_count = ch.filtered_buffer.get_latest(self.fft_size, &mut window);
        if read_count < self.fft_size {
            return None;
        }

        Some(compute_psd(&window, self.sample_rate, WindowFunction::Hann))
    }

    /// Computes band powers for a specific channel.
    pub fn get_band_powers(&self, channel: usize) -> Option<(BandPowers, RelativeBandPowers)> {
        let (freqs, psd) = self.get_psd(channel)?;
        let abs = compute_band_powers(&freqs, &psd);
        let rel = compute_relative_powers(&abs);
        Some((abs, rel))
    }

    /// Computes global cognitive state indices averaged across available channels.
    pub fn get_global_cognitive_metrics(&self) -> CognitiveMetrics {
        let mut sum_rel = RelativeBandPowers {
            delta: 0.0,
            theta: 0.0,
            alpha: 0.0,
            beta: 0.0,
            gamma: 0.0,
        };
        let mut valid_channels = 0;

        for ch_idx in 0..self.channels.len() {
            if let Some((_, rel)) = self.get_band_powers(ch_idx) {
                sum_rel.delta += rel.delta;
                sum_rel.theta += rel.theta;
                sum_rel.alpha += rel.alpha;
                sum_rel.beta += rel.beta;
                sum_rel.gamma += rel.gamma;
                valid_channels += 1;
            }
        }

        if valid_channels > 0 {
            let n = valid_channels as f32;
            let avg_rel = RelativeBandPowers {
                delta: sum_rel.delta / n,
                theta: sum_rel.theta / n,
                alpha: sum_rel.alpha / n,
                beta: sum_rel.beta / n,
                gamma: sum_rel.gamma / n,
            };
            compute_cognitive_metrics(&avg_rel)
        } else {
            CognitiveMetrics {
                focus_index: 0.5,
                engagement_index: 0.5,
                calm_index: 0.5,
                cognitive_workload: 1.0,
            }
        }
    }

    /// Evaluates biological and environmental artifacts (EOG blinks, EMG clenches).
    pub fn get_artifact_status(&self) -> ArtifactStatus {
        let mut frontal_samples = vec![0.0; 64]; // Recent ~250ms window at 256Hz
        let mut max_blink_strength = 0.0_f32;
        let mut blink_detected = false;
        let mut max_jaw_strength = 0.0_f32;
        let mut jaw_detected = false;
        let mut min_quality = 1.0_f32;

        for &ch_idx in &self.frontal_channel_indices {
            if let Some(ch) = self.channels.get(ch_idx) {
                let n = ch.filtered_buffer.get_latest(64, &mut frontal_samples);
                if n > 0 {
                    let (high_power, tot_power) = if let Some((abs, _)) = self.get_band_powers(ch_idx) {
                        (abs.beta + abs.gamma, abs.total)
                    } else {
                        (0.0, 1.0)
                    };

                    let art = evaluate_artifacts(&frontal_samples[..n], high_power, tot_power);
                    if art.blink_detected {
                        blink_detected = true;
                        max_blink_strength = max_blink_strength.max(art.blink_strength);
                    }
                    if art.jaw_clench_detected {
                        jaw_detected = true;
                        max_jaw_strength = max_jaw_strength.max(art.jaw_clench_strength);
                    }
                    min_quality = min_quality.min(art.signal_quality);
                }
            }
        }

        ArtifactStatus {
            blink_detected,
            blink_strength: max_blink_strength,
            jaw_clench_detected: jaw_detected,
            jaw_clench_strength: max_jaw_strength,
            signal_quality: min_quality,
        }
    }

    /// Enables or disables digital filtering across all channels.
    pub fn set_filters_enabled(&mut self, enabled: bool) {
        for ch in &mut self.channels {
            ch.filter_chain.set_enabled(enabled);
        }
    }

    /// Clears all internal ring buffers and filter state.
    pub fn reset(&mut self) {
        for ch in &mut self.channels {
            ch.raw_buffer.clear();
            ch.filtered_buffer.clear();
            ch.filter_chain.reset();
        }
    }
}
