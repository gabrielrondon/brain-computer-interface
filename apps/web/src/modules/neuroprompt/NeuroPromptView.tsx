import React, { useState } from 'react';
import { CognitiveMetrics } from '@cortex-bci/core';

interface NeuroPromptViewProps {
  cognitive: CognitiveMetrics;
}

export const NeuroPromptView: React.FC<NeuroPromptViewProps> = ({ cognitive }) => {
  const [userQuery, setUserQuery] = useState<string>(
    'Optimize memory bandwidth in real-time FFT algorithms'
  );
  const [simulatedOutput, setSimulatedOutput] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const isHighFocus = cognitive.focus_index >= 0.55;
  const isHighWorkload = cognitive.cognitive_workload >= 0.5;

  // Neuro-adaptive prompt configuration
  const promptMode = isHighWorkload
    ? 'SOCRATIC_DECONSTRUCTION'
    : isHighFocus
    ? 'HYPER_DENSE_EXECUTION'
    : 'BALANCED_PAIR_PROGRAMMER';

  const systemInstructions = {
    HYPER_DENSE_EXECUTION: {
      mode: 'High-Focus Mode (Beta Dominant)',
      badgeColor: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10',
      description:
        'Cognitive bandwidth is optimal. Eliminate explanations, polite filler, and preamble. Output high-throughput code and direct mathematical proofs.',
      systemPrompt: `You are an ultra-concise systems engineer. The user is in deep cognitive flow (Beta: ${cognitive.focus_index.toFixed(
        2
      )}x). Do NOT explain basic concepts. Provide production-grade, zero-allocation code immediately.`,
      sampleResponse: `// In-place Radix-2 FFT with Cache-line Spatial Locality
pub fn fft_radix2_optimized(real: &mut [f32], imag: &mut [f32]) {
    let n = real.len();
    bit_reverse_permute(real, imag);
    for len in (1..).map(|k| 1 << k).take_while(|&l| l <= n) {
        let half = len >> 1;
        let angle = -std::f32::consts::PI / half as f32;
        let (w_step_re, w_step_im) = (angle.cos(), angle.sin());
        for i in (0..n).step_by(len) {
            let (mut w_re, mut w_im) = (1.0, 0.0);
            for k in 0..half {
                let u_re = real[i + k];
                let u_im = imag[i + k];
                let v_re = real[i + k + half] * w_re - imag[i + k + half] * w_im;
                let v_im = real[i + k + half] * w_im + imag[i + k + half] * w_re;
                real[i + k] = u_re + v_re;
                imag[i + k] = u_im + v_im;
                real[i + k + half] = u_re - v_re;
                imag[i + k + half] = u_im - v_im;
                let nw_re = w_re * w_step_re - w_im * w_step_im;
                w_im = w_re * w_step_im + w_im * w_step_re;
                w_re = nw_re;
            }
        }
    }
}`,
    },
    SOCRATIC_DECONSTRUCTION: {
      mode: 'Cognitive Relief Mode (Theta / Fatigue)',
      badgeColor: 'text-neon-amber border-neon-amber/40 bg-neon-amber/10',
      description:
        'High cognitive workload detected. Prevent burnout by breaking the problem into discrete micro-steps, summarizing complexity, and providing clean architectural scaffolding.',
      systemPrompt: `The user is experiencing elevated cognitive load (Workload: ${cognitive.cognitive_workload.toFixed(
        2
      )}x). Break the solution down into 3 simple, digestible parts. Keep tone calm, concise, and structured.`,
      sampleResponse: `### Step 1: The Core Bottleneck
In real-time FFT, memory access is typically memory-bound rather than compute-bound because butterfly passes jump across cache lines.

### Step 2: Key Mitigations
1. **Cache Blocking**: Keep small 256-sample sub-transforms entirely inside L1 cache (32 KB).
2. **Precomputed Twiddle Factors**: Store cosine/sine lookup tables in contiguous memory.
3. **SIMD Vectorization**: Use AVX2 or NEON to process 4 or 8 butterfly operations simultaneously.

### Step 3: Minimal Scaffolding
\`\`\`rust
// Simple twiddle table lookup to reduce trigonometric overhead
struct FftPlanner {
    twiddles: Vec<(f32, f32)>,
}
\`\`\`
*Tip: Consider taking a 2-minute eye rest if fatigue persists.*`,
    },
    BALANCED_PAIR_PROGRAMMER: {
      mode: 'Exploratory Mode (Balanced State)',
      badgeColor: 'text-zinc-300 border-zinc-700 bg-zinc-800/60',
      description:
        'Standard operational baseline. Balances technical rigor with contextual architectural rationale.',
      systemPrompt: `Provide standard engineering explanations alongside verified code implementations.`,
      sampleResponse: `To optimize memory bandwidth in real-time FFT:
1. Ensure contiguous layout for real and imaginary buffers (interleaved vs separate planes).
2. Avoid heap reallocations by reusing an existing scratchpad buffer.
3. Apply Cooley-Tukey decimation-in-time with bit-reversal indexing.`,
    },
  };

  const activeConfig = systemInstructions[promptMode];

  const handleGenerate = () => {
    setIsGenerating(true);
    setSimulatedOutput(null);
    setTimeout(() => {
      setSimulatedOutput(activeConfig.sampleResponse);
      setIsGenerating(false);
    }, 600);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header telemetry badge */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-semibold text-zinc-100 uppercase tracking-wider">
              NeuroPrompt: Neuroadaptive AI Pair Programmer
            </h2>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${activeConfig.badgeColor}`}>
              {activeConfig.mode}
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            {activeConfig.description}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 bg-zinc-900/80 px-3 py-2 rounded-lg border border-card-border/40">
          <div>
            Beta Focus: <span className="text-neon-cyan font-bold">{cognitive.focus_index.toFixed(2)}x</span>
          </div>
          <div>
            Workload: <span className="text-neon-amber font-bold">{cognitive.cognitive_workload.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {/* Dynamic System Prompt Injection Inspector */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
        <span className="text-xs font-mono text-zinc-400 uppercase font-medium">
          Dynamically Injected Context & System Constraints:
        </span>
        <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[12px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
          {activeConfig.systemPrompt}
        </pre>
      </div>

      {/* Interactive Query & Response Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-3">
            <span className="text-xs font-mono text-zinc-400 uppercase font-medium">
              User Prompt
            </span>
            <textarea
              rows={4}
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-neon-cyan resize-none"
              placeholder="Enter programming question or task..."
            />

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-medium text-neon-cyan border border-neon-cyan/40 transition-colors disabled:opacity-50"
            >
              {isGenerating ? 'Compiling Neuro-Adaptive Context...' : 'Generate with Brain State'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <div className="p-4 rounded-xl bg-card border border-card-border/60 flex-1 flex flex-col gap-2 min-h-[300px]">
            <div className="flex items-center justify-between pb-2 border-b border-card-border/40">
              <span className="text-xs font-mono text-zinc-400 uppercase font-medium">
                Adapted Response Stream
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                Mode: {promptMode}
              </span>
            </div>

            <div className="flex-1 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 overflow-y-auto whitespace-pre-wrap">
              {simulatedOutput ? (
                simulatedOutput
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 italic">
                  Press 'Generate with Brain State' or adjust the neural preset to observe dynamic instruction adaptation.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
