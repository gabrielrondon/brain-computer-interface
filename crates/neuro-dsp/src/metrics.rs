//! Frequency band decomposition, cognitive state indexing, and artifact classification.

use serde::{Deserialize, Serialize};

/// Canonical electroencephalographic spectral frequency bands.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct BandPowers {
    pub delta: f32, // 0.5 - 4.0 Hz (Deep sleep, unconscious)
    pub theta: f32, // 4.0 - 8.0 Hz (Drowsiness, memory access, deep meditation)
    pub alpha: f32, // 8.0 - 13.0 Hz (Relaxed alertness, eyes closed)
    pub beta: f32,  // 13.0 - 30.0 Hz (Active thinking, focus, problem solving)
    pub gamma: f32, // 30.0 - 45.0 Hz (High-level cognitive binding, sensory processing)
    pub total: f32,
}

/// Normalized relative band power proportions (each between 0.0 and 1.0, sum = 1.0).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RelativeBandPowers {
    pub delta: f32,
    pub theta: f32,
    pub alpha: f32,
    pub beta: f32,
    pub gamma: f32,
}

/// Derived neurophysiological and cognitive engagement states.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CognitiveMetrics {
    pub focus_index: f32,        // Beta / (Theta + Alpha)
    pub engagement_index: f32,   // Beta / (Alpha + Theta)
    pub calm_index: f32,         // Alpha / (Theta + Beta)
    pub cognitive_workload: f32, // Theta / Alpha
}

/// Real-time biological and environmental artifact classification.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ArtifactStatus {
    pub blink_detected: bool,
    pub blink_strength: f32,
    pub jaw_clench_detected: bool,
    pub jaw_clench_strength: f32,
    pub signal_quality: f32, // 0.0 (unusable/railed) to 1.0 (laboratory grade)
}

/// Integrates Power Spectral Density across specified frequency limits.
pub fn integrate_band(freqs: &[f32], psd: &[f32], low: f32, high: f32) -> f32 {
    if freqs.is_empty() || psd.is_empty() || freqs.len() != psd.len() {
        return 0.0;
    }

    let df = if freqs.len() > 1 {
        freqs[1] - freqs[0]
    } else {
        1.0
    };

    let mut sum = 0.0_f32;
    for (&f, &p) in freqs.iter().zip(psd.iter()) {
        if f >= low && f < high {
            sum += p * df;
        }
    }
    sum
}

/// Computes absolute band powers from frequency and PSD arrays.
pub fn compute_band_powers(freqs: &[f32], psd: &[f32]) -> BandPowers {
    let delta = integrate_band(freqs, psd, 0.5, 4.0);
    let theta = integrate_band(freqs, psd, 4.0, 8.0);
    let alpha = integrate_band(freqs, psd, 8.0, 13.0);
    let beta = integrate_band(freqs, psd, 13.0, 30.0);
    let gamma = integrate_band(freqs, psd, 30.0, 45.0);
    let total = delta + theta + alpha + beta + gamma;

    BandPowers {
        delta,
        theta,
        alpha,
        beta,
        gamma,
        total: total.max(1e-6),
    }
}

/// Computes normalized relative band powers.
pub fn compute_relative_powers(bands: &BandPowers) -> RelativeBandPowers {
    let tot = bands.total.max(1e-6);
    RelativeBandPowers {
        delta: bands.delta / tot,
        theta: bands.theta / tot,
        alpha: bands.alpha / tot,
        beta: bands.beta / tot,
        gamma: bands.gamma / tot,
    }
}

/// Calculates cognitive state indices from spectral band powers.
pub fn compute_cognitive_metrics(rel: &RelativeBandPowers) -> CognitiveMetrics {
    let denom_focus = (rel.theta + rel.alpha).max(1e-4);
    let focus = rel.beta / denom_focus;

    let denom_calm = (rel.theta + rel.beta).max(1e-4);
    let calm = rel.alpha / denom_calm;

    let denom_workload = rel.alpha.max(1e-4);
    let workload = rel.theta / denom_workload;

    CognitiveMetrics {
        focus_index: focus.clamp(0.0, 3.0),
        engagement_index: (rel.beta / (rel.alpha + rel.theta).max(1e-4)).clamp(0.0, 3.0),
        calm_index: calm.clamp(0.0, 3.0),
        cognitive_workload: workload.clamp(0.0, 5.0),
    }
}

/// Evaluates time-domain and frequency-domain properties for artifact identification.
pub fn evaluate_artifacts(
    frontal_time_series: &[f32],
    high_freq_power: f32,
    total_power: f32,
) -> ArtifactStatus {
    if frontal_time_series.is_empty() {
        return ArtifactStatus {
            blink_detected: false,
            blink_strength: 0.0,
            jaw_clench_detected: false,
            jaw_clench_strength: 0.0,
            signal_quality: 0.0,
        };
    }

    // 1. Peak-to-peak amplitude variance for EOG (Eye blink) detection
    let mut min_val = f32::MAX;
    let mut max_val = f32::MIN;
    let mut abs_sum = 0.0;

    for &val in frontal_time_series {
        if val < min_val {
            min_val = val;
        }
        if val > max_val {
            max_val = val;
        }
        abs_sum += val.abs();
    }

    let p2p = max_val - min_val;
    let mean_abs = abs_sum / frontal_time_series.len() as f32;

    // Normal cortical EEG amplitude is between 10 uV and 50 uV.
    // EOG blinks produce sudden deflection exceeding 100 - 180 uV.
    let blink_threshold = 95.0;
    let blink_detected = p2p > blink_threshold;
    let blink_strength = ((p2p - blink_threshold) / 100.0).clamp(0.0, 1.0);

    // 2. High-frequency broadband power ratio for EMG (Muscle/Jaw Clench)
    let emg_ratio = high_freq_power / total_power.max(1e-4);
    let jaw_clench_detected = emg_ratio > 0.45;
    let jaw_clench_strength = ((emg_ratio - 0.45) / 0.4).clamp(0.0, 1.0);

    // 3. Signal quality: Penalize extreme railing or zero signal
    let is_railed = max_val > 900.0 || min_val < -900.0;
    let is_flatline = mean_abs < 0.1;

    let signal_quality = if is_railed || is_flatline {
        0.05
    } else if jaw_clench_detected {
        0.4
    } else if blink_detected {
        0.75
    } else {
        0.98
    };

    ArtifactStatus {
        blink_detected,
        blink_strength,
        jaw_clench_detected,
        jaw_clench_strength,
        signal_quality,
    }
}
