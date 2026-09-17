import React, { useState, useEffect, useRef } from 'react';
import { ArtifactStatus, CognitiveMetrics } from '@cortex-bci/core';

interface NeuroTriggerViewProps {
  cognitive: CognitiveMetrics;
  artifacts: ArtifactStatus;
  onTriggerBlink: () => void;
  onTriggerJawClench: () => void;
}

interface TriggerEvent {
  id: string;
  timestamp: string;
  ruleName: string;
  condition: string;
  action: string;
}

export const NeuroTriggerView: React.FC<NeuroTriggerViewProps> = ({
  cognitive,
  artifacts,
  onTriggerBlink,
  onTriggerJawClench,
}) => {
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const lastBlinkRef = useRef<boolean>(false);
  const lastClenchRef = useRef<boolean>(false);
  const focusTimeRef = useRef<number>(0);

  // Evaluate rules on incoming telemetry
  useEffect(() => {
    const now = new Date().toLocaleTimeString();

    // Rule 1: Frontal Blink
    if (artifacts.blink_detected && !lastBlinkRef.current) {
      lastBlinkRef.current = true;
      dispatchTrigger({
        ruleName: 'Presentation Slide Controller',
        condition: 'EOG Frontal Impulse (Peak > 95 uV)',
        action: 'Dispatch Keydown [ArrowRight / Spacebar]',
        timestamp: now,
      });
    } else if (!artifacts.blink_detected) {
      lastBlinkRef.current = false;
    }

    // Rule 2: Jaw Clench
    if (artifacts.jaw_clench_detected && !lastClenchRef.current) {
      lastClenchRef.current = true;
      dispatchTrigger({
        ruleName: 'EMG Clench Interrupter',
        condition: 'High-Frequency Gamma Spurt (> 30 Hz RMS)',
        action: 'Toggle Microphone Mute / Pause Media',
        timestamp: now,
      });
    } else if (!artifacts.jaw_clench_detected) {
      lastClenchRef.current = false;
    }

    // Rule 3: Sustained High Focus
    if (cognitive.focus_index > 0.65) {
      focusTimeRef.current += 1;
      if (focusTimeRef.current === 8) {
        // approx 2 seconds sustained
        dispatchTrigger({
          ruleName: 'Deep Work Flow Shield',
          condition: 'Beta / (Theta+Alpha) > 0.65 sustained for 2s',
          action: 'Mute System Notifications & Enable Do-Not-Disturb',
          timestamp: now,
        });
      }
    } else {
      focusTimeRef.current = 0;
    }
  }, [cognitive, artifacts]);

  const dispatchTrigger = (event: Omit<TriggerEvent, 'id'>) => {
    setEvents((prev) => [
      {
        ...event,
        id: Math.random().toString(36).substring(7),
      },
      ...prev.slice(0, 19), // Keep latest 20 events
    ]);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header and Telemetry */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-semibold text-zinc-100 uppercase tracking-wider">
              NeuroTrigger: Deterministic Event-Condition-Action Engine
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border text-neon-emerald border-neon-emerald/40 bg-neon-emerald/10">
              Active Rule Engine
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Bridges physiological thresholds directly to system automations, webhook dispatches, and user interface controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerBlink}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-medium text-neon-cyan border border-zinc-700 transition-colors"
          >
            Test Blink Trigger
          </button>
          <button
            onClick={onTriggerJawClench}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-medium text-neon-crimson border border-zinc-700 transition-colors"
          >
            Test Clench Trigger
          </button>
        </div>
      </div>

      {/* Configured Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-200">
              1. Presentation Clicker
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                artifacts.blink_detected ? 'bg-neon-cyan animate-ping' : 'bg-zinc-700'
              }`}
            />
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            <strong>Condition:</strong> EOG Blink peak &gt; 95 µV
          </div>
          <div className="text-[11px] font-mono text-neon-cyan">
            <strong>Action:</strong> Dispatch Keydown ArrowRight
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-200">
              2. Deep Focus Shield
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                cognitive.focus_index > 0.65 ? 'bg-neon-emerald animate-ping' : 'bg-zinc-700'
              }`}
            />
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            <strong>Condition:</strong> Focus Index &gt; 0.65 for 2s
          </div>
          <div className="text-[11px] font-mono text-neon-emerald">
            <strong>Action:</strong> Enable Do-Not-Disturb Mode
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-zinc-200">
              3. EMG Panic Mute
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                artifacts.jaw_clench_detected ? 'bg-neon-crimson animate-ping' : 'bg-zinc-700'
              }`}
            />
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            <strong>Condition:</strong> Jaw Clench &gt; 30 Hz RMS
          </div>
          <div className="text-[11px] font-mono text-neon-crimson">
            <strong>Action:</strong> Instant Media Pause & Mute
          </div>
        </div>
      </div>

      {/* Real-time Event Execution Log */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-card-border/40">
          <span className="text-xs font-mono text-zinc-400 uppercase font-medium">
            Trigger Execution History (Chronological)
          </span>
          <button
            onClick={() => setEvents([])}
            className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 underline"
          >
            Clear Log
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-zinc-600 italic">
              No triggers fired yet. Blink or clench jaw to dispatch actions.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-[10px]">{ev.timestamp}</span>
                  <span className="font-semibold text-zinc-200">{ev.ruleName}</span>
                  <span className="text-zinc-500 hidden md:inline">({ev.condition})</span>
                </div>
                <span className="text-neon-cyan font-medium">{ev.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
