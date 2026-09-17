/**
 * Spectral band power distribution (in microvolts squared per Hertz).
 */
export interface BandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
  total: number;
}

/**
 * Normalized relative band proportions (0.0 to 1.0, summing to 1.0).
 */
export interface RelativeBandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
}

/**
 * High-level derived cognitive indices.
 */
export interface CognitiveMetrics {
  focus_index: number;
  engagement_index: number;
  calm_index: number;
  cognitive_workload: number;
}

/**
 * Biological and hardware artifact detection status.
 */
export interface ArtifactStatus {
  blink_detected: bool_alias;
  blink_strength: number;
  jaw_clench_detected: bool_alias;
  jaw_clench_strength: number;
  signal_quality: number;
}

type bool_alias = boolean;

/**
 * Channel-specific spectral report.
 */
export interface ChannelBandReport {
  channel: number;
  absolute: BandPowers;
  relative: RelativeBandPowers;
}

/**
 * Power Spectral Density report for a given channel.
 */
export interface PsdReport {
  channel: number;
  freqs: number[];
  psd: number[];
}

/**
 * Unified real-time telemetry snapshot emitted across the pipeline.
 */
export interface TelemetrySnapshot {
  timestamp_ms: number;
  cognitive: CognitiveMetrics;
  artifacts: ArtifactStatus;
  channels: ChannelBandReport[];
  raw_samples?: number[][];
}

/**
 * Standard electrode channel names and 10-20 system mappings.
 */
export type ElectrodeChannel = 'TP9' | 'AF7' | 'AF8' | 'TP10' | 'Fp1' | 'Fp2' | 'C3' | 'C4' | 'O1' | 'O2';
