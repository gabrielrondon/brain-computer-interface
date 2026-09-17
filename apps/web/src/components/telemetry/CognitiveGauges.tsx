import React from 'react';
import { ArtifactStatus, CognitiveMetrics } from '@cortex-bci/core';

interface CognitiveGaugesProps {
  cognitive: CognitiveMetrics;
  artifacts: ArtifactStatus;
  isWasm: boolean;
}

export const CognitiveGauges: React.FC<CognitiveGaugesProps> = ({
  cognitive,
  artifacts,
  isWasm,
}) => {
  const focusPct = Math.min(100, Math.round((cognitive.focus_index / 2.0) * 100));
  const calmPct = Math.min(100, Math.round((cognitive.calm_index / 2.0) * 100));
  const workloadPct = Math.min(100, Math.round((cognitive.cognitive_workload / 3.0) * 100));
  const qualityPct = Math.round(artifacts.signal_quality * 100);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
      {/* 1. Focus Index */}
      <div className="flex flex-col justify-between p-3.5 rounded-xl bg-card border border-card-border/60">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>Focus Ratio (Beta / (Theta+Alpha))</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
            {cognitive.focus_index.toFixed(2)}x
          </span>
        </div>
        <div className="my-2">
          <div className="text-2xl font-mono font-bold text-zinc-100">{focusPct}%</div>
          <div className="text-[11px] font-mono text-zinc-500">
            {focusPct > 65 ? 'Deep Focused State' : focusPct > 35 ? 'Moderate Engagement' : 'Passive / Diffuse'}
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-neon-cyan rounded-full transition-all duration-300 shadow-[0_0_8px_#00f2fe]"
            style={{ width: `${focusPct}%` }}
          />
        </div>
      </div>

      {/* 2. Calm Index */}
      <div className="flex flex-col justify-between p-3.5 rounded-xl bg-card border border-card-border/60">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>Calm Index (Alpha Ratio)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-amber/10 text-neon-amber border border-neon-amber/20">
            {cognitive.calm_index.toFixed(2)}x
          </span>
        </div>
        <div className="my-2">
          <div className="text-2xl font-mono font-bold text-zinc-100">{calmPct}%</div>
          <div className="text-[11px] font-mono text-zinc-500">
            {calmPct > 60 ? 'Relaxed / Eyes Closed' : calmPct > 30 ? 'Alert Rest' : 'High Cognitive Arousal'}
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-neon-amber rounded-full transition-all duration-300 shadow-[0_0_8px_#f59e0b]"
            style={{ width: `${calmPct}%` }}
          />
        </div>
      </div>

      {/* 3. Cognitive Workload */}
      <div className="flex flex-col justify-between p-3.5 rounded-xl bg-card border border-card-border/60">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>Workload / Theta Index</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-emerald/10 text-neon-emerald border border-neon-emerald/20">
            {cognitive.cognitive_workload.toFixed(2)}x
          </span>
        </div>
        <div className="my-2">
          <div className="text-2xl font-mono font-bold text-zinc-100">{workloadPct}%</div>
          <div className="text-[11px] font-mono text-zinc-500">
            {workloadPct > 70 ? 'High Memory Load / Fatigue' : 'Sustainable Cognitive Load'}
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-neon-emerald rounded-full transition-all duration-300 shadow-[0_0_8px_#10b981]"
            style={{ width: `${workloadPct}%` }}
          />
        </div>
      </div>

      {/* 4. Biological Artifacts & Hardware Signal Quality */}
      <div className="flex flex-col justify-between p-3.5 rounded-xl bg-card border border-card-border/60">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>Signal Quality</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              isWasm
                ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30'
                : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {isWasm ? 'Rust WASM (SIMD)' : 'TS DSP Engine'}
          </span>
        </div>
        <div className="my-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-zinc-100">{qualityPct}%</span>
            <div className="flex items-center gap-1.5">
              {artifacts.blink_detected && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 animate-pulse">
                  BLINK
                </span>
              )}
              {artifacts.jaw_clench_detected && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-neon-crimson/20 text-neon-crimson border border-neon-crimson/50 animate-pulse">
                  EMG CLENCH
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {qualityPct > 90 ? 'Nominal Electrode Contact' : 'Impedance Warning / Noise'}
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              qualityPct > 80 ? 'bg-neon-emerald' : 'bg-neon-amber'
            }`}
            style={{ width: `${qualityPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};
