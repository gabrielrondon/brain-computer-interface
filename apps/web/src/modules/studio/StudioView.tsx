import React, { useState } from 'react';
import { CorticalMesh } from '../../components/3d/CorticalMesh';
import { SignalOscilloscope } from '../../components/charts/SignalOscilloscope';
import { SpectrumAnalyzer } from '../../components/charts/SpectrumAnalyzer';
import { CognitiveGauges } from '../../components/telemetry/CognitiveGauges';
import { TelemetrySnapshot } from '@cortex-bci/core';
import { SimulationPreset } from '@cortex-bci/simulator';

interface StudioViewProps {
  telemetry: TelemetrySnapshot;
  rawChannelData: Float32Array[] | number[][];
  channelNames: string[];
  isWasm: boolean;
  onSetPreset: (preset: SimulationPreset) => void;
  onTriggerBlink: () => void;
  onTriggerJawClench: () => void;
  filtersEnabled: boolean;
  onToggleFilters: (enabled: boolean) => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  telemetry,
  rawChannelData,
  channelNames,
  isWasm,
  onSetPreset,
  onTriggerBlink,
  onTriggerJawClench,
  filtersEnabled,
  onToggleFilters,
}) => {
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<SimulationPreset>('ACTIVE_FOCUS');

  const handlePresetSelect = (preset: SimulationPreset) => {
    setActivePreset(preset);
    onSetPreset(preset);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Telemetry HUD Gauges */}
      <CognitiveGauges
        cognitive={telemetry.cognitive}
        artifacts={telemetry.artifacts}
        isWasm={isWasm}
      />

      {/* Main Signal Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 3D Cortical Mesh (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="h-[420px] w-full">
            <CorticalMesh
              cognitive={telemetry.cognitive}
              relativeBands={telemetry.channels[0]?.relative}
              wireframe={wireframe}
            />
          </div>

          {/* Quick Simulation & Hardware Controls Bar */}
          <div className="p-3 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="uppercase font-medium">Neural State Profiles</span>
              <button
                onClick={() => setWireframe(!wireframe)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
              >
                {wireframe ? 'Shaded Cortex' : 'Wireframe Mesh'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              {(
                [
                  { id: 'ACTIVE_FOCUS', label: 'Active Focus (Beta)' },
                  { id: 'RESTING_ALPHA', label: 'Resting (Alpha Spindles)' },
                  { id: 'COGNITIVE_FATIGUE', label: 'Fatigue / High Theta' },
                  { id: 'ARTIFACT_DEMO', label: 'Artifact Storm' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                    activePreset === p.id
                      ? 'bg-zinc-800 border-neon-cyan/50 text-neon-cyan font-medium'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Manual Artifact Trigger Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-card-border/40">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Inject:</span>
              <button
                onClick={onTriggerBlink}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
              >
                Simulate Blink (EOG)
              </button>
              <button
                onClick={onTriggerJawClench}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-200 border border-zinc-700 active:scale-95 transition-transform"
              >
                Simulate Clench (EMG)
              </button>
              <button
                onClick={() => onToggleFilters(!filtersEnabled)}
                className={`ml-auto px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                  filtersEnabled
                    ? 'bg-neon-emerald/10 border-neon-emerald/40 text-neon-emerald'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {filtersEnabled ? 'Filters Active' : 'Raw Bypass'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Oscilloscope & Spectrum Analyzer (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[270px] w-full">
            <SignalOscilloscope
              channelData={rawChannelData}
              channelNames={channelNames}
              sampleRate={256}
              timeWindowSeconds={3}
            />
          </div>

          <div className="min-h-[220px] w-full">
            <SpectrumAnalyzer
              channels={telemetry.channels}
              channelNames={channelNames}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
