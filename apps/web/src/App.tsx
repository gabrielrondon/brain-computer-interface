import React, { useEffect, useRef, useState } from 'react';
import {
  createEegPipeline,
  PipelineInstance,
  TelemetrySnapshot,
} from '@cortex-bci/core';
import {
  HardwareTransport,
  MuseBluetoothTransport,
  SimulatorTransport,
  WebSocketLslTransport,
} from '@cortex-bci/hardware';
import { SimulationPreset } from '@cortex-bci/simulator';

import { StudioView } from './modules/studio/StudioView';
import { NeuroPromptView } from './modules/neuroprompt/NeuroPromptView';
import { GhostTypeView } from './modules/ghosttype/GhostTypeView';
import { NeuroTriggerView } from './modules/neurotrigger/NeuroTriggerView';

type AppMode = 'STUDIO' | 'NEUROPROMPT' | 'GHOSTTYPE' | 'NEUROTRIGGER';

export const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>('STUDIO');
  const [transportType, setTransportType] = useState<'SIMULATOR' | 'MUSE' | 'LSL'>('SIMULATOR');
  const [isWasmActive, setIsWasmActive] = useState<boolean>(false);
  const [filtersEnabled, setFiltersEnabled] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('Streaming Synthetic Biological Sockets');

  const pipelineRef = useRef<PipelineInstance | null>(null);
  const transportRef = useRef<HardwareTransport | null>(null);
  const rawBuffersRef = useRef<number[][]>([[], [], [], []]);

  // Telemetry state driven at ~20 Hz
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    timestamp_ms: 0,
    cognitive: {
      focus_index: 0.5,
      engagement_index: 0.5,
      calm_index: 0.5,
      cognitive_workload: 0.5,
    },
    artifacts: {
      blink_detected: false,
      blink_strength: 0,
      jaw_clench_detected: false,
      jaw_clench_strength: 0,
      signal_quality: 0.98,
    },
    channels: [],
  });

  const [rawDisplayData, setRawDisplayData] = useState<number[][]>([[], [], [], []]);

  // Initialize pipeline and default simulator transport
  useEffect(() => {
    let unsubscribeTransport: (() => void) | null = null;
    let telemetryInterval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      // 1. Initialize Dual-Engine Pipeline (Rust WASM or pure TS DSP)
      const pipeline = await createEegPipeline(4, 256, 2048, 256);
      pipelineRef.current = pipeline;
      setIsWasmActive(pipeline.isWasm);

      // 2. Initialize default Simulator Transport
      const sim = new SimulatorTransport('ACTIVE_FOCUS');
      transportRef.current = sim;
      await sim.connect();

      // 3. Ingest frames into pipeline and raw rolling buffer
      unsubscribeTransport = sim.onFrame((frame) => {
        pipeline.pushInterleavedFrame(frame);

        // Keep rolling buffer for 3-second display (256 * 3 = 768 samples)
        const maxDisplaySamples = 768;
        for (let ch = 0; ch < 4; ch++) {
          const val = frame[ch] ?? 0;
          rawBuffersRef.current[ch].push(val);
          if (rawBuffersRef.current[ch].length > maxDisplaySamples) {
            rawBuffersRef.current[ch].shift();
          }
        }
      });

      // 4. Update UI telemetry snapshot at 20 Hz
      telemetryInterval = setInterval(() => {
        if (pipelineRef.current) {
          const snapshot = pipelineRef.current.getTelemetrySnapshot(performance.now());
          setTelemetry(snapshot);
          setRawDisplayData(rawBuffersRef.current.map((arr) => [...arr]));
        }
      }, 50);
    }

    init();

    return () => {
      if (unsubscribeTransport) unsubscribeTransport();
      if (telemetryInterval) clearInterval(telemetryInterval);
      if (transportRef.current) transportRef.current.disconnect();
    };
  }, []);

  // Switch hardware transport
  const handleSelectTransport = async (type: 'SIMULATOR' | 'MUSE' | 'LSL') => {
    if (transportRef.current) {
      await transportRef.current.disconnect();
      transportRef.current = null;
    }

    try {
      if (type === 'MUSE') {
        setConnectionStatus('Requesting Muse Web-Bluetooth GATT connection...');
        const muse = new MuseBluetoothTransport();
        await muse.connect();
        transportRef.current = muse;
        setTransportType('MUSE');
        setConnectionStatus('Connected to Muse 2/S Headband (256 Hz)');
      } else if (type === 'LSL') {
        setConnectionStatus('Connecting to WebSocket LSL bridge at ws://localhost:8080/eeg...');
        const lsl = new WebSocketLslTransport();
        await lsl.connect();
        transportRef.current = lsl;
        setTransportType('LSL');
        setConnectionStatus('Connected to Research LSL WebSocket');
      } else {
        const sim = new SimulatorTransport('ACTIVE_FOCUS');
        await sim.connect();
        transportRef.current = sim;
        setTransportType('SIMULATOR');
        setConnectionStatus('Streaming Synthetic Biological Sockets');
      }

      if (transportRef.current && pipelineRef.current) {
        transportRef.current.onFrame((frame) => {
          pipelineRef.current?.pushInterleavedFrame(frame);
          for (let ch = 0; ch < 4; ch++) {
            const val = frame[ch] ?? 0;
            rawBuffersRef.current[ch].push(val);
            if (rawBuffersRef.current[ch].length > 768) {
              rawBuffersRef.current[ch].shift();
            }
          }
        });
      }
    } catch (err: any) {
      alert(`Hardware connection error: ${err.message || err}`);
      // Fallback to simulator
      const sim = new SimulatorTransport('ACTIVE_FOCUS');
      await sim.connect();
      transportRef.current = sim;
      setTransportType('SIMULATOR');
      setConnectionStatus('Fallback: Streaming Synthetic Biological Sockets');
    }
  };

  const handleSetPreset = (preset: SimulationPreset) => {
    if (transportRef.current && 'setPreset' in transportRef.current) {
      (transportRef.current as SimulatorTransport).setPreset(preset);
    }
  };

  const handleTriggerBlink = () => {
    if (transportRef.current && 'triggerBlink' in transportRef.current) {
      (transportRef.current as SimulatorTransport).triggerBlink();
    }
  };

  const handleTriggerJawClench = () => {
    if (transportRef.current && 'triggerJawClench' in transportRef.current) {
      (transportRef.current as SimulatorTransport).triggerJawClench();
    }
  };

  const handleToggleFilters = (enabled: boolean) => {
    setFiltersEnabled(enabled);
    pipelineRef.current?.setFiltersEnabled(enabled);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-card-border/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-card-border flex items-center justify-center font-mono font-bold text-neon-cyan shadow-[0_0_12px_#00f2fe33]">
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm tracking-wider text-zinc-100">
                  CORTEX BCI
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  v0.1.0
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                High-Performance Neural Telemetry & Runtime
              </span>
            </div>
          </div>

          {/* Module Mode Selector Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-card-border/60 font-mono text-xs">
            {(
              [
                { id: 'STUDIO', label: 'Studio' },
                { id: 'NEUROPROMPT', label: 'NeuroPrompt' },
                { id: 'GHOSTTYPE', label: 'GhostType' },
                { id: 'NEUROTRIGGER', label: 'NeuroTrigger' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeMode === tab.id
                    ? 'bg-zinc-800 text-neon-cyan font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Hardware & Pipeline Badge */}
          <div className="flex items-center gap-3">
            {/* Transport Dropdown */}
            <select
              value={transportType}
              onChange={(e) => handleSelectTransport(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-neon-cyan"
            >
              <option value="SIMULATOR">Simulator (256 Hz)</option>
              <option value="MUSE">Muse 2/S (Web-Bluetooth)</option>
              <option value="LSL">Research LSL (WebSocket)</option>
            </select>

            {/* Core Engine Status */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border ${
                isWasmActive
                  ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isWasmActive ? 'bg-neon-blue animate-pulse' : 'bg-zinc-600'}`} />
              <span>{isWasmActive ? 'Rust WASM' : 'TS DSP'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-header status strip */}
      <div className="bg-zinc-950 border-b border-card-border/30 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-emerald animate-pulse" />
            <span className="text-zinc-400">{connectionStatus}</span>
          </div>
          <div className="flex items-center gap-4 hidden sm:flex">
            <span>Electrodes: TP9, AF7, AF8, TP10</span>
            <span>Filters: Notch 50/60Hz + Bandpass (0.5-45Hz)</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeMode === 'STUDIO' && (
          <StudioView
            telemetry={telemetry}
            rawChannelData={rawDisplayData}
            channelNames={['TP9', 'AF7', 'AF8', 'TP10']}
            isWasm={isWasmActive}
            onSetPreset={handleSetPreset}
            onTriggerBlink={handleTriggerBlink}
            onTriggerJawClench={handleTriggerJawClench}
            filtersEnabled={filtersEnabled}
            onToggleFilters={handleToggleFilters}
          />
        )}

        {activeMode === 'NEUROPROMPT' && (
          <NeuroPromptView cognitive={telemetry.cognitive} />
        )}

        {activeMode === 'GHOSTTYPE' && (
          <GhostTypeView
            artifacts={telemetry.artifacts}
            onTriggerBlink={handleTriggerBlink}
          />
        )}

        {activeMode === 'NEUROTRIGGER' && (
          <NeuroTriggerView
            cognitive={telemetry.cognitive}
            artifacts={telemetry.artifacts}
            onTriggerBlink={handleTriggerBlink}
            onTriggerJawClench={handleTriggerJawClench}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-card-border/40 py-4 px-4 bg-zinc-950/60 text-center text-xs font-mono text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Cortex BCI - Open-Source Neural Runtime</span>
          <span>Dual-Engine: Rust/WASM + TypeScript Reference Pipeline</span>
          <span>Apache-2.0 License</span>
        </div>
      </footer>
    </div>
  );
};
