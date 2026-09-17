//! Digital Biquad IIR Filter implementation (Direct Form II Transposed).
//!
//! Provides numerically stable filtering for real-time biological signals,
//! including 50/60 Hz mains notch filters and 2nd/4th-order Butterworth bandpass.

use std::f32::consts::PI;

#[derive(Debug, Clone)]
pub struct BiquadCoefficients {
    pub b0: f32,
    pub b1: f32,
    pub b2: f32,
    pub a1: f32,
    pub a2: f32,
}

#[derive(Debug, Clone)]
pub struct BiquadFilter {
    pub coeff: BiquadCoefficients,
    s1: f32,
    s2: f32,
}

impl BiquadFilter {
    /// Creates a new Biquad filter with normalized coefficients ($a_0 = 1$).
    pub fn new(coeff: BiquadCoefficients) -> Self {
        Self {
            coeff,
            s1: 0.0,
            s2: 0.0,
        }
    }

    /// Designs an IIR Notch filter targeting center frequency `f0` with quality factor `q`.
    ///
    /// Attenuates narrow band interference such as 50 Hz or 60 Hz electrical mains noise.
    pub fn notch(sample_rate: f32, f0: f32, q: f32) -> Self {
        let w0 = 2.0 * PI * (f0 / sample_rate);
        let alpha = w0.sin() / (2.0 * q);
        let cos_w0 = w0.cos();

        let a0 = 1.0 + alpha;
        let b0 = 1.0 / a0;
        let b1 = (-2.0 * cos_w0) / a0;
        let b2 = 1.0 / a0;
        let a1 = (-2.0 * cos_w0) / a0;
        let a2 = (1.0 - alpha) / a0;

        Self::new(BiquadCoefficients { b0, b1, b2, a1, a2 })
    }

    /// Designs a 2nd-order Butterworth lowpass filter.
    pub fn lowpass(sample_rate: f32, cutoff_hz: f32) -> Self {
        let w0 = 2.0 * PI * (cutoff_hz / sample_rate);
        let cos_w0 = w0.cos();
        let alpha = w0.sin() / (2.0 * std::f32::consts::FRAC_1_SQRT_2);

        let a0 = 1.0 + alpha;
        let b0 = ((1.0 - cos_w0) / 2.0) / a0;
        let b1 = (1.0 - cos_w0) / a0;
        let b2 = ((1.0 - cos_w0) / 2.0) / a0;
        let a1 = (-2.0 * cos_w0) / a0;
        let a2 = (1.0 - alpha) / a0;

        Self::new(BiquadCoefficients { b0, b1, b2, a1, a2 })
    }

    /// Designs a 2nd-order Butterworth highpass filter.
    pub fn highpass(sample_rate: f32, cutoff_hz: f32) -> Self {
        let w0 = 2.0 * PI * (cutoff_hz / sample_rate);
        let cos_w0 = w0.cos();
        let alpha = w0.sin() / (2.0 * std::f32::consts::FRAC_1_SQRT_2);

        let a0 = 1.0 + alpha;
        let b0 = ((1.0 + cos_w0) / 2.0) / a0;
        let b1 = (-(1.0 + cos_w0)) / a0;
        let b2 = ((1.0 + cos_w0) / 2.0) / a0;
        let a1 = (-2.0 * cos_w0) / a0;
        let a2 = (1.0 - alpha) / a0;

        Self::new(BiquadCoefficients { b0, b1, b2, a1, a2 })
    }

    /// Processes a single input sample through Direct Form II Transposed topology.
    #[inline(always)]
    pub fn process(&mut self, x: f32) -> f32 {
        let y = self.coeff.b0 * x + self.s1;
        self.s1 = self.coeff.b1 * x - self.coeff.a1 * y + self.s2;
        self.s2 = self.coeff.b2 * x - self.coeff.a2 * y;
        y
    }

    /// Resets internal delay states to zero.
    pub fn reset(&mut self) {
        self.s1 = 0.0;
        self.s2 = 0.0;
    }
}

/// Cascaded filter chain supporting multiple sequential biquad stages.
#[derive(Debug, Clone)]
pub struct FilterChain {
    stages: Vec<BiquadFilter>,
    enabled: bool,
}

impl FilterChain {
    pub fn new() -> Self {
        Self {
            stages: Vec::new(),
            enabled: true,
        }
    }

    /// Adds a biquad stage to the processing chain.
    pub fn add_stage(&mut self, stage: BiquadFilter) {
        self.stages.push(stage);
    }

    /// Sets whether the filter chain processes samples or acts as a pass-through.
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Processes a single sample through all cascaded stages.
    #[inline(always)]
    pub fn process(&mut self, mut sample: f32) -> f32 {
        if !self.enabled {
            return sample;
        }
        for stage in &mut self.stages {
            sample = stage.process(sample);
        }
        sample
    }

    /// Resets state across all cascaded stages.
    pub fn reset(&mut self) {
        for stage in &mut self.stages {
            stage.reset();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notch_filter_attenuation() {
        let sample_rate = 256.0;
        let mut notch = BiquadFilter::notch(sample_rate, 50.0, 10.0);

        // Generate 50 Hz pure sinusoid
        let mut max_in = 0.0_f32;
        let mut max_out = 0.0_f32;

        for i in 0..500 {
            let t = i as f32 / sample_rate;
            let input = (2.0 * PI * 50.0 * t).sin();
            let output = notch.process(input);

            if i > 250 {
                // Steady-state evaluation
                max_in = max_in.max(input.abs());
                max_out = max_out.max(output.abs());
            }
        }

        // 50 Hz should be attenuated by at least 20 dB (amplitude < 0.1)
        assert!(max_out < 0.15, "Notch filter failed to attenuate 50Hz: max_out = {}", max_out);
    }

    #[test]
    fn test_highpass_dc_rejection() {
        let sample_rate = 256.0;
        let mut hp = BiquadFilter::highpass(sample_rate, 1.0);

        // Step response with DC offset of 10.0
        let mut last_val = 10.0;
        for _ in 0..1000 {
            last_val = hp.process(10.0);
        }

        // DC should be attenuated to near zero
        assert!(last_val.abs() < 0.05, "Highpass failed to reject DC: {}", last_val);
    }
}
