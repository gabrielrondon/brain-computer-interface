/**
 * Realistic synthetic electroencephalogram (EEG) signal generator.
 *
 * Emulates biological 1/f spectral background activity, alpha rhythm spindle bursts,
 * electrooculographic (EOG) blink potentials, and electromyographic (EMG) muscle transients.
 */

export type SimulationPreset =
  | 'RESTING_ALPHA'
  | 'ACTIVE_FOCUS'
  | 'COGNITIVE_FATIGUE'
  | 'ARTIFACT_DEMO';

export interface SimulatorConfig {
  sampleRate: number;
  numChannels: number;
  channelNames: string[];
  preset: SimulationPreset;
  blinkIntervalSeconds: number; // 0 to disable automated blinks
}

export const DEFAULT_CONFIG: SimulatorConfig = {
  sampleRate: 256,
  numChannels: 4,
  channelNames: ['TP9', 'AF7', 'AF8', 'TP10'],
  preset: 'ACTIVE_FOCUS',
  blinkIntervalSeconds: 4.5,
};

/**
 * 1/f Pink Noise generator using the Voss-McCartney algorithm.
 */
class PinkNoiseGenerator {
  private values: Float32Array;
  private maxKey: number;
  private key = 0;

  constructor(numRows = 16) {
    this.values = new Float32Array(numRows);
    this.maxKey = (1 << numRows) - 1;
    for (let i = 0; i < numRows; i++) {
      this.values[i] = (Math.random() - 0.5) * 2;
    }
  }

  next(): number {
    let lastKey = this.key;
    this.key++;
    if (this.key > this.maxKey) this.key = 0;
    const diff = lastKey ^ this.key;

    let sum = 0;
    for (let i = 0; i < this.values.length; i++) {
      if ((diff & (1 << i)) !== 0) {
        this.values[i] = (Math.random() - 0.5) * 2;
      }
      sum += this.values[i];
    }
    return sum / (this.values.length * 0.5);
  }
}

export class BiologicalSignalSimulator {
  private config: SimulatorConfig;
  private pinkGenerators: PinkNoiseGenerator[];
  private timeStep = 0;
  private blinkProgress = -1; // -1 when idle, >= 0 when in blink phase
  private blinkDurationSamples = 45; // ~175 ms at 256 Hz
  private clenchProgress = -1;
  private clenchDurationSamples = 80;

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pinkGenerators = Array.from(
      { length: this.config.numChannels },
      () => new PinkNoiseGenerator(16)
    );
  }

  public setPreset(preset: SimulationPreset): void {
    this.config.preset = preset;
  }

  public triggerBlink(): void {
    this.blinkProgress = 0;
  }

  public triggerJawClench(): void {
    this.clenchProgress = 0;
  }

  /**
   * Generates a single interleaved multi-channel sample vector: [ch0, ch1, ch2, ch3].
   * Values are expressed in microvolts (uV), centered around 0 uV.
   */
  public nextFrame(): number[] {
    const { sampleRate, numChannels, preset } = this.config;
    const t = this.timeStep / sampleRate;
    const frame: number[] = new Array(numChannels);

    // Amplitudes configured per preset
    let alphaAmp = 8.0;   // 10 Hz
    let betaAmp = 12.0;   // 20 Hz
    let thetaAmp = 5.0;   // 6 Hz
    let deltaAmp = 6.0;   // 2 Hz
    let noiseScale = 7.0;

    switch (preset) {
      case 'RESTING_ALPHA':
        alphaAmp = 28.0; // Spindle bursts
        betaAmp = 4.0;
        thetaAmp = 6.0;
        deltaAmp = 4.0;
        break;
      case 'ACTIVE_FOCUS':
        alphaAmp = 4.0;  // Alpha suppression
        betaAmp = 22.0;  // High beta activity
        thetaAmp = 3.0;
        deltaAmp = 3.0;
        break;
      case 'COGNITIVE_FATIGUE':
        alphaAmp = 12.0;
        betaAmp = 5.0;
        thetaAmp = 24.0; // High theta workload/drowsiness
        deltaAmp = 12.0;
        break;
      case 'ARTIFACT_DEMO':
        alphaAmp = 10.0;
        betaAmp = 10.0;
        thetaAmp = 8.0;
        break;
    }

    // Automated periodic blinks
    if (this.config.blinkIntervalSeconds > 0) {
      const intervalSamples = Math.floor(this.config.blinkIntervalSeconds * sampleRate);
      if (this.timeStep % intervalSamples === 0) {
        this.triggerBlink();
      }
    }

    // Compute active artifact offsets
    let blinkPotential = 0;
    if (this.blinkProgress >= 0) {
      const p = this.blinkProgress / this.blinkDurationSamples;
      // Asymmetric biphasic bell curve: peak deflection ~ 120 uV
      blinkPotential = 135.0 * Math.sin(Math.PI * p) * (1.0 - 0.3 * Math.cos(2 * Math.PI * p));
      this.blinkProgress++;
      if (this.blinkProgress >= this.blinkDurationSamples) {
        this.blinkProgress = -1;
      }
    }

    let clenchPotential = 0;
    if (this.clenchProgress >= 0) {
      // High-frequency broadband muscle tremor (40-90 Hz)
      const p = this.clenchProgress / this.clenchDurationSamples;
      const envelope = Math.sin(Math.PI * p);
      clenchPotential = (Math.random() - 0.5) * 90.0 * envelope;
      this.clenchProgress++;
      if (this.clenchProgress >= this.clenchDurationSamples) {
        this.clenchProgress = -1;
      }
    }

    for (let ch = 0; ch < numChannels; ch++) {
      const chName = this.config.channelNames[ch] ?? `CH${ch}`;
      const isFrontal = chName.startsWith('AF') || chName.startsWith('Fp');
      const isTemporal = chName.startsWith('TP') || chName.startsWith('T');

      // 1. Biological 1/f background noise
      const pink = this.pinkGenerators[ch].next() * noiseScale;

      // 2. Coherent neural rhythms with spatial phase offsets
      const phaseOffset = ch * 0.4;
      const delta = deltaAmp * Math.sin(2 * Math.PI * 2.2 * t + phaseOffset);
      const theta = thetaAmp * Math.sin(2 * Math.PI * 6.1 * t + phaseOffset * 1.5);
      // Posterior electrodes (TP9, TP10, O1, O2) show stronger alpha
      const alphaWeight = isTemporal ? 1.3 : 0.6;
      const alpha = alphaAmp * alphaWeight * Math.sin(2 * Math.PI * 10.2 * t + phaseOffset);
      // Frontal electrodes show stronger beta in focus
      const betaWeight = isFrontal ? 1.4 : 0.8;
      const beta = betaAmp * betaWeight * Math.sin(2 * Math.PI * 19.5 * t + phaseOffset * 0.7);

      // 3. Artifact injection
      // Blinks strongly manifest on frontal electrodes (AF7, AF8), minimally on temporals
      const blinkCoupling = isFrontal ? 1.0 : 0.12;
      // Clenches strongly manifest on temporals near the masseter muscle
      const clenchCoupling = isTemporal ? 1.0 : 0.4;

      const rawUv =
        pink +
        delta +
        theta +
        alpha +
        beta +
        blinkPotential * blinkCoupling +
        clenchPotential * clenchCoupling;

      frame[ch] = rawUv;
    }

    this.timeStep++;
    return frame;
  }

  /**
   * Generates `count` consecutive frames.
   */
  public nextBatch(count: number): number[][] {
    const batch: number[][] = new Array(count);
    for (let i = 0; i < count; i++) {
      batch[i] = this.nextFrame();
    }
    return batch;
  }

  public reset(): void {
    this.timeStep = 0;
    this.blinkProgress = -1;
    this.clenchProgress = -1;
  }
}
