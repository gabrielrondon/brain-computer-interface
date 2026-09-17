export * from './types.js';
export * from './fallback-dsp.js';

import { TsEegPipeline } from './fallback-dsp.js';
import { TelemetrySnapshot } from './types.js';

export interface PipelineInstance {
  pushSample(channel: number, rawSample: number): number;
  pushInterleavedFrame(frame: number[]): void;
  getLatestFiltered(channel: number, count: number): Float32Array | number[];
  getTelemetrySnapshot(timestampMs: number): TelemetrySnapshot;
  setFiltersEnabled(enabled: boolean): void;
  reset(): void;
  readonly isWasm: boolean;
}

/**
 * Creates a pipeline instance, attempting to instantiate the optimized Rust/WASM core,
 * with graceful fallback to the pure TypeScript DSP pipeline.
 */
export async function createEegPipeline(
  numChannels = 4,
  sampleRate = 256,
  bufferCapacity = 2048,
  fftSize = 256
): Promise<PipelineInstance> {
  try {
    // Dynamic import to support environments where WASM is loaded asynchronously or in workers
    const wasmModule = await import('./wasm/neuro_dsp.js').catch(() => null);
    if (wasmModule && wasmModule.default) {
      await wasmModule.default();
      const wasmPipeline = new wasmModule.WasmEegPipeline(
        numChannels,
        sampleRate,
        bufferCapacity,
        fftSize
      );

      return {
        pushSample(ch: number, val: number) {
          return wasmPipeline.push_sample(ch, val);
        },
        pushInterleavedFrame(frame: number[]) {
          wasmPipeline.push_interleaved_frame(new Float32Array(frame));
        },
        getLatestFiltered(ch: number, count: number) {
          return wasmPipeline.get_latest_filtered(ch, count);
        },
        getTelemetrySnapshot(timestampMs: number): TelemetrySnapshot {
          return wasmPipeline.get_telemetry_snapshot(timestampMs);
        },
        setFiltersEnabled(enabled: boolean) {
          wasmPipeline.set_filters_enabled(enabled);
        },
        reset() {
          wasmPipeline.reset();
        },
        isWasm: true,
      };
    }
  } catch {
    // Graceful fallback to TypeScript reference pipeline
  }

  const ts = new TsEegPipeline(numChannels, sampleRate, bufferCapacity, fftSize);
  return {
    pushSample(ch: number, val: number) {
      return ts.pushSample(ch, val);
    },
    pushInterleavedFrame(frame: number[]) {
      ts.pushInterleavedFrame(frame);
    },
    getLatestFiltered(ch: number, count: number) {
      return ts.getLatestFiltered(ch, count);
    },
    getTelemetrySnapshot(timestampMs: number): TelemetrySnapshot {
      return ts.getTelemetrySnapshot(timestampMs);
    },
    setFiltersEnabled(enabled: boolean) {
      ts.setFiltersEnabled(enabled);
    },
    reset() {
      ts.reset();
    },
    isWasm: false,
  };
}
