/* tslint:disable */
/* eslint-disable */

export class WasmEegPipeline {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns real-time biological artifact classification (blinks, jaw clenches, impedance).
     */
    get_artifact_status(): any;
    /**
     * Returns absolute and relative spectral band powers for a specific channel.
     */
    get_band_powers(channel: number): any;
    /**
     * Returns high-level cognitive engagement indices (Focus, Calm, Workload).
     */
    get_cognitive_metrics(): any;
    /**
     * Extracts the latest `count` filtered samples for a given channel.
     */
    get_latest_filtered(channel: number, count: number): Float32Array;
    /**
     * Returns Power Spectral Density frequencies and magnitude values.
     */
    get_psd(channel: number): any;
    /**
     * Generates a unified snapshot containing spectral analysis, metrics, and artifact status.
     */
    get_telemetry_snapshot(timestamp_ms: number): any;
    /**
     * Instantiates a new WebAssembly EEG pipeline.
     */
    constructor(num_channels: number, sample_rate: number, buffer_capacity: number, fft_size: number);
    /**
     * Pushes a contiguous chunk of samples for a given channel index.
     */
    push_chunk(channel: number, samples: Float32Array): void;
    /**
     * Pushes an interleaved multi-channel frame [ch0, ch1, ch2, ch3].
     */
    push_interleaved_frame(frame: Float32Array): void;
    /**
     * Pushes a single raw biological sample for a given channel index.
     */
    push_sample(channel: number, raw_sample: number): number;
    /**
     * Resets all buffers and filter history.
     */
    reset(): void;
    /**
     * Enables or disables the digital IIR filter stages.
     */
    set_filters_enabled(enabled: boolean): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmeegpipeline_free: (a: number, b: number) => void;
    readonly wasmeegpipeline_get_artifact_status: (a: number, b: number) => void;
    readonly wasmeegpipeline_get_band_powers: (a: number, b: number, c: number) => void;
    readonly wasmeegpipeline_get_cognitive_metrics: (a: number, b: number) => void;
    readonly wasmeegpipeline_get_latest_filtered: (a: number, b: number, c: number, d: number) => void;
    readonly wasmeegpipeline_get_psd: (a: number, b: number, c: number) => void;
    readonly wasmeegpipeline_get_telemetry_snapshot: (a: number, b: number, c: number) => void;
    readonly wasmeegpipeline_new: (a: number, b: number, c: number, d: number) => number;
    readonly wasmeegpipeline_push_chunk: (a: number, b: number, c: number, d: number) => void;
    readonly wasmeegpipeline_push_interleaved_frame: (a: number, b: number, c: number) => void;
    readonly wasmeegpipeline_push_sample: (a: number, b: number, c: number) => number;
    readonly wasmeegpipeline_reset: (a: number) => void;
    readonly wasmeegpipeline_set_filters_enabled: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
