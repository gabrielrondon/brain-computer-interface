//! In-place Radix-2 Fast Fourier Transform and Power Spectral Density estimation.
//!
//! Provides spectral transformation of time-series EEG windows without external dependencies.

use std::f32::consts::PI;

/// Windowing functions applied prior to spectral transformation to minimize spectral leakage.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowFunction {
    Rectangular,
    Hann,
    Hamming,
}

impl WindowFunction {
    /// Computes the window coefficient for sample index `i` of total length `n`.
    pub fn value(&self, i: usize, n: usize) -> f32 {
        if n <= 1 {
            return 1.0;
        }
        match self {
            Self::Rectangular => 1.0,
            Self::Hann => 0.5 * (1.0 - ((2.0 * PI * i as f32) / (n - 1) as f32).cos()),
            Self::Hamming => 0.54 - 0.46 * ((2.0 * PI * i as f32) / (n - 1) as f32).cos(),
        }
    }

    /// Computes the sum of squared window weights, required for power normalization.
    pub fn coherent_power(&self, n: usize) -> f32 {
        (0..n).map(|i| self.value(i, n).powi(2)).sum()
    }
}

/// Applies in-place Radix-2 Cooley-Tukey Decimation-in-Time FFT.
///
/// Input arrays `real` and `imag` must have a power-of-two length.
pub fn fft_radix2(real: &mut [f32], imag: &mut [f32]) {
    let n = real.len();
    assert_eq!(n, imag.len(), "Real and imaginary slices must have matching lengths");
    assert!(n.is_power_of_two(), "FFT length must be a power of two");

    // Bit-reversal permutation
    let mut j = 0;
    for i in 0..n - 1 {
        if i < j {
            real.swap(i, j);
            imag.swap(i, j);
        }
        let mut k = n >> 1;
        while k <= j {
            j -= k;
            k >>= 1;
        }
        j += k;
    }

    // Cooley-Tukey butterflies
    let mut len = 2;
    while len <= n {
        let half = len / 2;
        let angle = -2.0 * PI / len as f32;
        let w_step_re = angle.cos();
        let w_step_im = angle.sin();

        let mut i = 0;
        while i < n {
            let mut w_re = 1.0;
            let mut w_im = 0.0;

            for k in 0..half {
                let idx_even = i + k;
                let idx_odd = idx_even + half;

                let u_re = real[idx_even];
                let u_im = imag[idx_even];

                let v_re = real[idx_odd] * w_re - imag[idx_odd] * w_im;
                let v_im = real[idx_odd] * w_im + imag[idx_odd] * w_re;

                real[idx_even] = u_re + v_re;
                imag[idx_even] = u_im + v_im;

                real[idx_odd] = u_re - v_re;
                imag[idx_odd] = u_im - v_im;

                let next_w_re = w_re * w_step_re - w_im * w_step_im;
                let next_w_im = w_re * w_step_im + w_im * w_step_re;
                w_re = next_w_re;
                w_im = next_w_im;
            }
            i += len;
        }
        len <<= 1;
    }
}

/// Computes the single-sided Power Spectral Density (PSD) of a real input window.
///
/// Returns a vector of length `n / 2 + 1` representing power in $\mu V^2 / Hz$.
pub fn compute_psd(
    signal: &[f32],
    sample_rate: f32,
    window_type: WindowFunction,
) -> (Vec<f32>, Vec<f32>) {
    let n = signal.len();
    assert!(n.is_power_of_two(), "Window length must be a power of two");

    let mut real = vec![0.0; n];
    let mut imag = vec![0.0; n];

    // Apply window function
    for i in 0..n {
        real[i] = signal[i] * window_type.value(i, n);
    }

    // Execute transform
    fft_radix2(&mut real, &mut imag);

    let num_bins = n / 2 + 1;
    let mut freqs = Vec::with_capacity(num_bins);
    let mut psd = Vec::with_capacity(num_bins);

    let freq_resolution = sample_rate / n as f32;
    let window_power = window_type.coherent_power(n);
    let norm_factor = 2.0 / (sample_rate * window_power);

    for i in 0..num_bins {
        freqs.push(i as f32 * freq_resolution);
        let magnitude_sq = real[i] * real[i] + imag[i] * imag[i];

        // Single-sided scaling: DC and Nyquist are not doubled
        let scale = if i == 0 || i == n / 2 {
            norm_factor * 0.5
        } else {
            norm_factor
        };
        psd.push(magnitude_sq * scale);
    }

    (freqs, psd)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fft_frequency_detection() {
        let sample_rate = 256.0;
        let n = 256; // 1 second window, 1 Hz resolution
        let target_freq = 10.0; // 10 Hz alpha wave

        let mut signal = vec![0.0; n];
        for i in 0..n {
            let t = i as f32 / sample_rate;
            signal[i] = 10.0 * (2.0 * PI * target_freq * t).sin();
        }

        let (freqs, psd) = compute_psd(&signal, sample_rate, WindowFunction::Hann);

        // Find peak frequency
        let mut max_idx = 0;
        let mut max_p = 0.0;
        for (i, &p) in psd.iter().enumerate() {
            if p > max_p {
                max_p = p;
                max_idx = i;
            }
        }

        assert_eq!(freqs[max_idx], target_freq, "Peak frequency must match 10 Hz sinusoid");
    }
}
