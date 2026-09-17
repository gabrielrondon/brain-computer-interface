import {
  ArtifactStatus,
  BandPowers,
  ChannelBandReport,
  CognitiveMetrics,
  PsdReport,
  RelativeBandPowers,
  TelemetrySnapshot,
} from './types.js';

/**
 * Pure TypeScript Biquad filter (Direct Form II Transposed).
 * Mirrors the exact numerical parameters of the Rust core.
 */
export class TsBiquadFilter {
  private b0: number;
  private b1: number;
  private b2: number;
  private a1: number;
  private a2: number;
  private s1 = 0;
  private s2 = 0;

  constructor(b0: number, b1: number, b2: number, a1: number, a2: number) {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
  }

  static notch(sampleRate: number, f0: number, q: number): TsBiquadFilter {
    const w0 = (2.0 * Math.PI * f0) / sampleRate;
    const alpha = Math.sin(w0) / (2.0 * q);
    const cosW0 = Math.cos(w0);

    const a0 = 1.0 + alpha;
    return new TsBiquadFilter(
      1.0 / a0,
      (-2.0 * cosW0) / a0,
      1.0 / a0,
      (-2.0 * cosW0) / a0,
      (1.0 - alpha) / a0
    );
  }

  static lowpass(sampleRate: number, cutoffHz: number): TsBiquadFilter {
    const w0 = (2.0 * Math.PI * cutoffHz) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2.0 * Math.SQRT1_2);

    const a0 = 1.0 + alpha;
    return new TsBiquadFilter(
      (1.0 - cosW0) / 2.0 / a0,
      (1.0 - cosW0) / a0,
      (1.0 - cosW0) / 2.0 / a0,
      (-2.0 * cosW0) / a0,
      (1.0 - alpha) / a0
    );
  }

  static highpass(sampleRate: number, cutoffHz: number): TsBiquadFilter {
    const w0 = (2.0 * Math.PI * cutoffHz) / sampleRate;
    const cosW0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2.0 * Math.SQRT1_2);

    const a0 = 1.0 + alpha;
    return new TsBiquadFilter(
      (1.0 + cosW0) / 2.0 / a0,
      -(1.0 + cosW0) / a0,
      (1.0 + cosW0) / 2.0 / a0,
      (-2.0 * cosW0) / a0,
      (1.0 - alpha) / a0
    );
  }

  process(x: number): number {
    const y = this.b0 * x + this.s1;
    this.s1 = this.b1 * x - this.a1 * y + this.s2;
    this.s2 = this.b2 * x - this.a2 * y;
    return y;
  }

  reset(): void {
    this.s1 = 0;
    this.s2 = 0;
  }
}

/**
 * Pure TypeScript multi-channel pipeline providing instant execution
 * and serving as the reference baseline for WASM benchmarks.
 */
export class TsEegPipeline {
  readonly numChannels: number;
  readonly sampleRate: number;
  readonly bufferCapacity: number;
  readonly fftSize: number;

  private rawBuffers: Float32Array[];
  private filteredBuffers: Float32Array[];
  private writePointers: number[];
  private filters: TsBiquadFilter[][];
  private filtersEnabled = true;

  constructor(numChannels = 4, sampleRate = 256, bufferCapacity = 2048, fftSize = 256) {
    this.numChannels = numChannels;
    this.sampleRate = sampleRate;
    this.bufferCapacity = bufferCapacity;
    this.fftSize = fftSize;

    this.rawBuffers = Array.from({ length: numChannels }, () => new Float32Array(bufferCapacity));
    this.filteredBuffers = Array.from({ length: numChannels }, () => new Float32Array(bufferCapacity));
    this.writePointers = new Array(numChannels).fill(0);

    this.filters = Array.from({ length: numChannels }, () => [
      TsBiquadFilter.highpass(sampleRate, 0.5),
      TsBiquadFilter.lowpass(sampleRate, 45.0),
      TsBiquadFilter.notch(sampleRate, 50.0, 10.0),
      TsBiquadFilter.notch(sampleRate, 60.0, 10.0),
    ]);
  }

  pushSample(channel: number, rawSample: number): number {
    if (channel < 0 || channel >= this.numChannels) return 0;

    const wp = this.writePointers[channel];
    this.rawBuffers[channel][wp] = rawSample;

    let filtered = rawSample;
    if (this.filtersEnabled) {
      for (const filter of this.filters[channel]) {
        filtered = filter.process(filtered);
      }
    }
    this.filteredBuffers[channel][wp] = filtered;
    this.writePointers[channel] = (wp + 1) % this.bufferCapacity;

    return filtered;
  }

  pushInterleavedFrame(frame: number[]): void {
    for (let ch = 0; ch < Math.min(frame.length, this.numChannels); ch++) {
      this.pushSample(ch, frame[ch]);
    }
  }

  getLatestFiltered(channel: number, count: number): Float32Array {
    const out = new Float32Array(count);
    if (channel < 0 || channel >= this.numChannels) return out;

    const buf = this.filteredBuffers[channel];
    const wp = this.writePointers[channel];
    const n = Math.min(count, this.bufferCapacity);

    const start = wp >= n ? wp - n : this.bufferCapacity + wp - n;
    for (let i = 0; i < n; i++) {
      out[i] = buf[(start + i) % this.bufferCapacity];
    }
    return out;
  }

  getPsd(channel: number): PsdReport | null {
    if (channel < 0 || channel >= this.numChannels) return null;

    const windowData = this.getLatestFiltered(channel, this.fftSize);
    const n = this.fftSize;

    const real = new Float32Array(n);
    const imag = new Float32Array(n);

    // Apply Hann window
    let windowPower = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (n - 1)));
      real[i] = windowData[i] * w;
      windowPower += w * w;
    }

    this.fftRadix2(real, imag);

    const numBins = n / 2 + 1;
    const freqs: number[] = new Array(numBins);
    const psd: number[] = new Array(numBins);
    const df = this.sampleRate / n;
    const norm = 2.0 / (this.sampleRate * windowPower);

    for (let i = 0; i < numBins; i++) {
      freqs[i] = i * df;
      const magSq = real[i] * real[i] + imag[i] * imag[i];
      psd[i] = (i === 0 || i === n / 2 ? norm * 0.5 : norm) * magSq;
    }

    return { channel, freqs, psd };
  }

  getBandPowers(channel: number): ChannelBandReport | null {
    const psdRep = this.getPsd(channel);
    if (!psdRep) return null;

    const { freqs, psd } = psdRep;
    const df = freqs.length > 1 ? freqs[1] - freqs[0] : 1;

    let delta = 0, theta = 0, alpha = 0, beta = 0, gamma = 0;
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      const p = psd[i] * df;
      if (f >= 0.5 && f < 4.0) delta += p;
      else if (f >= 4.0 && f < 8.0) theta += p;
      else if (f >= 8.0 && f < 13.0) alpha += p;
      else if (f >= 13.0 && f < 30.0) beta += p;
      else if (f >= 30.0 && f < 45.0) gamma += p;
    }

    const total = Math.max(1e-6, delta + theta + alpha + beta + gamma);
    const absolute: BandPowers = { delta, theta, alpha, beta, gamma, total };
    const relative: RelativeBandPowers = {
      delta: delta / total,
      theta: theta / total,
      alpha: alpha / total,
      beta: beta / total,
      gamma: gamma / total,
    };

    return { channel, absolute, relative };
  }

  getTelemetrySnapshot(timestampMs: number): TelemetrySnapshot {
    const channelReports: ChannelBandReport[] = [];
    let sumDelta = 0, sumTheta = 0, sumAlpha = 0, sumBeta = 0, sumGamma = 0;

    for (let ch = 0; ch < this.numChannels; ch++) {
      const rep = this.getBandPowers(ch);
      if (rep) {
        channelReports.push(rep);
        sumDelta += rep.relative.delta;
        sumTheta += rep.relative.theta;
        sumAlpha += rep.relative.alpha;
        sumBeta += rep.relative.beta;
        sumGamma += rep.relative.gamma;
      }
    }

    const count = Math.max(1, channelReports.length);
    const avgRel: RelativeBandPowers = {
      delta: sumDelta / count,
      theta: sumTheta / count,
      alpha: sumAlpha / count,
      beta: sumBeta / count,
      gamma: sumGamma / count,
    };

    const focus = avgRel.beta / Math.max(1e-4, avgRel.theta + avgRel.alpha);
    const calm = avgRel.alpha / Math.max(1e-4, avgRel.theta + avgRel.beta);
    const workload = avgRel.theta / Math.max(1e-4, avgRel.alpha);

    const cognitive: CognitiveMetrics = {
      focus_index: Math.min(3.0, Math.max(0, focus)),
      engagement_index: Math.min(3.0, Math.max(0, avgRel.beta / Math.max(1e-4, avgRel.alpha + avgRel.theta))),
      calm_index: Math.min(3.0, Math.max(0, calm)),
      cognitive_workload: Math.min(5.0, Math.max(0, workload)),
    };

    // Artifact estimation
    const frontal = this.getLatestFiltered(1, 64);
    let minV = Infinity, maxV = -Infinity;
    for (let i = 0; i < frontal.length; i++) {
      if (frontal[i] < minV) minV = frontal[i];
      if (frontal[i] > maxV) maxV = frontal[i];
    }
    const p2p = maxV - minV;
    const blinkDetected = p2p > 95.0;

    const artifacts: ArtifactStatus = {
      blink_detected: blinkDetected,
      blink_strength: blinkDetected ? Math.min(1.0, (p2p - 95.0) / 100.0) : 0,
      jaw_clench_detected: avgRel.gamma > 0.4,
      jaw_clench_strength: avgRel.gamma > 0.4 ? Math.min(1.0, (avgRel.gamma - 0.4) / 0.3) : 0,
      signal_quality: blinkDetected ? 0.75 : 0.98,
    };

    return {
      timestamp_ms: timestampMs,
      cognitive,
      artifacts,
      channels: channelReports,
    };
  }

  setFiltersEnabled(enabled: boolean): void {
    this.filtersEnabled = enabled;
  }

  reset(): void {
    for (let i = 0; i < this.numChannels; i++) {
      this.rawBuffers[i].fill(0);
      this.filteredBuffers[i].fill(0);
      this.writePointers[i] = 0;
      for (const f of this.filters[i]) f.reset();
    }
  }

  private fftRadix2(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = real[i]; real[i] = real[j]; real[j] = tr;
        const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const angle = (-2.0 * Math.PI) / len;
      const wStepRe = Math.cos(angle);
      const wStepIm = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wRe = 1.0;
        let wIm = 0.0;
        for (let k = 0; k < half; k++) {
          const uRe = real[i + k];
          const uIm = imag[i + k];
          const vRe = real[i + k + half] * wRe - imag[i + k + half] * wIm;
          const vIm = real[i + k + half] * wIm + imag[i + k + half] * wRe;

          real[i + k] = uRe + vRe;
          imag[i + k] = uIm + vIm;
          real[i + k + half] = uRe - vRe;
          imag[i + k + half] = uIm - vIm;

          const nextWRe = wRe * wStepRe - wIm * wStepIm;
          const nextWIm = wRe * wStepIm + wIm * wStepRe;
          wRe = nextWRe;
          wIm = nextWIm;
        }
      }
    }
  }
}
