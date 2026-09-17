//! neuro-dsp: High-performance real-time EEG signal processing in WebAssembly.
//!
//! Exposes an optimized multi-channel digital signal processing pipeline
//! for filtering, Fourier transforms, spectral band estimation, and artifact detection.

pub mod fft;
pub mod filters;
pub mod metrics;
pub mod pipeline;
pub mod ring_buffer;

use pipeline::EegPipeline;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
pub struct ChannelBandReport {
    pub channel: usize,
    pub absolute: metrics::BandPowers,
    pub relative: metrics::RelativeBandPowers,
}

#[derive(Serialize, Deserialize)]
pub struct PsdReport {
    pub channel: usize,
    pub freqs: Vec<f32>,
    pub psd: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub timestamp_ms: f64,
    pub cognitive: metrics::CognitiveMetrics,
    pub artifacts: metrics::ArtifactStatus,
    pub channels: Vec<ChannelBandReport>,
}

#[wasm_bindgen]
pub struct WasmEegPipeline {
    inner: EegPipeline,
}

#[wasm_bindgen]
impl WasmEegPipeline {
    /// Instantiates a new WebAssembly EEG pipeline.
    #[wasm_bindgen(constructor)]
    pub fn new(
        num_channels: usize,
        sample_rate: f32,
        buffer_capacity: usize,
        fft_size: usize,
    ) -> Self {
        Self {
            inner: EegPipeline::new(num_channels, sample_rate, buffer_capacity, fft_size),
        }
    }

    /// Pushes a single raw biological sample for a given channel index.
    pub fn push_sample(&mut self, channel: usize, raw_sample: f32) -> f32 {
        self.inner.push_sample(channel, raw_sample)
    }

    /// Pushes a contiguous chunk of samples for a given channel index.
    pub fn push_chunk(&mut self, channel: usize, samples: &[f32]) {
        self.inner.push_chunk(channel, samples);
    }

    /// Pushes an interleaved multi-channel frame [ch0, ch1, ch2, ch3].
    pub fn push_interleaved_frame(&mut self, frame: &[f32]) {
        for (ch, &val) in frame.iter().enumerate() {
            if ch < self.inner.channels.len() {
                self.inner.push_sample(ch, val);
            }
        }
    }

    /// Extracts the latest `count` filtered samples for a given channel.
    pub fn get_latest_filtered(&self, channel: usize, count: usize) -> Vec<f32> {
        let mut buffer = vec![0.0; count];
        let read = self.inner.get_latest_filtered(channel, count, &mut buffer);
        buffer.truncate(read);
        buffer
    }

    /// Returns Power Spectral Density frequencies and magnitude values.
    pub fn get_psd(&self, channel: usize) -> Result<JsValue, JsValue> {
        if let Some((freqs, psd)) = self.inner.get_psd(channel) {
            let report = PsdReport {
                channel,
                freqs,
                psd,
            };
            serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            Err(JsValue::from_str("Insufficient samples for PSD calculation"))
        }
    }

    /// Returns absolute and relative spectral band powers for a specific channel.
    pub fn get_band_powers(&self, channel: usize) -> Result<JsValue, JsValue> {
        if let Some((absolute, relative)) = self.inner.get_band_powers(channel) {
            let report = ChannelBandReport {
                channel,
                absolute,
                relative,
            };
            serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            Err(JsValue::from_str("Insufficient samples for band powers"))
        }
    }

    /// Returns high-level cognitive engagement indices (Focus, Calm, Workload).
    pub fn get_cognitive_metrics(&self) -> Result<JsValue, JsValue> {
        let metrics = self.inner.get_global_cognitive_metrics();
        serde_wasm_bindgen::to_value(&metrics).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Returns real-time biological artifact classification (blinks, jaw clenches, impedance).
    pub fn get_artifact_status(&self) -> Result<JsValue, JsValue> {
        let status = self.inner.get_artifact_status();
        serde_wasm_bindgen::to_value(&status).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Generates a unified snapshot containing spectral analysis, metrics, and artifact status.
    pub fn get_telemetry_snapshot(&self, timestamp_ms: f64) -> Result<JsValue, JsValue> {
        let cognitive = self.inner.get_global_cognitive_metrics();
        let artifacts = self.inner.get_artifact_status();

        let mut channel_reports = Vec::with_capacity(self.inner.channels.len());
        for ch in 0..self.inner.channels.len() {
            if let Some((absolute, relative)) = self.inner.get_band_powers(ch) {
                channel_reports.push(ChannelBandReport {
                    channel: ch,
                    absolute,
                    relative,
                });
            }
        }

        let snapshot = TelemetrySnapshot {
            timestamp_ms,
            cognitive,
            artifacts,
            channels: channel_reports,
        };

        serde_wasm_bindgen::to_value(&snapshot).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Enables or disables the digital IIR filter stages.
    pub fn set_filters_enabled(&mut self, enabled: bool) {
        self.inner.set_filters_enabled(enabled);
    }

    /// Resets all buffers and filter history.
    pub fn reset(&mut self) {
        self.inner.reset();
    }
}
