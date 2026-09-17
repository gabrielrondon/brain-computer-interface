import React, { useState } from 'react';
import { ChannelBandReport } from '@cortex-bci/core';

interface SpectrumAnalyzerProps {
  channels: ChannelBandReport[];
  channelNames?: string[];
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  channels,
  channelNames = ['TP9', 'AF7', 'AF8', 'TP10'],
}) => {
  const [selectedChannel, setSelectedChannel] = useState<number>(-1); // -1 = Averaged across channels

  // Compute active relative band distribution
  let delta = 0, theta = 0, alpha = 0, beta = 0, gamma = 0;

  if (channels.length > 0) {
    if (selectedChannel === -1) {
      // Average across all channels
      for (const ch of channels) {
        delta += ch.relative.delta;
        theta += ch.relative.theta;
        alpha += ch.relative.alpha;
        beta += ch.relative.beta;
        gamma += ch.relative.gamma;
      }
      const n = channels.length;
      delta /= n;
      theta /= n;
      alpha /= n;
      beta /= n;
      gamma /= n;
    } else {
      const active = channels.find((c) => c.channel === selectedChannel);
      if (active) {
        delta = active.relative.delta;
        theta = active.relative.theta;
        alpha = active.relative.alpha;
        beta = active.relative.beta;
        gamma = active.relative.gamma;
      }
    }
  }

  const bands = [
    {
      name: 'Delta',
      range: '0.5 - 4 Hz',
      val: delta,
      color: '#818cf8',
      desc: 'Deep sleep, restorative',
    },
    {
      name: 'Theta',
      range: '4 - 8 Hz',
      val: theta,
      color: '#34d399',
      desc: 'Meditation, cognitive memory',
    },
    {
      name: 'Alpha',
      range: '8 - 13 Hz',
      val: alpha,
      color: '#f59e0b',
      desc: 'Relaxed alertness, eyes closed',
    },
    {
      name: 'Beta',
      range: '13 - 30 Hz',
      val: beta,
      color: '#00f2fe',
      desc: 'Active thinking, focus, problem solving',
    },
    {
      name: 'Gamma',
      range: '30 - 45 Hz',
      val: gamma,
      color: '#f43f5e',
      desc: 'Sensory binding, high cognitive load',
    },
  ];

  return (
    <div className="flex flex-col w-full h-full rounded-xl bg-card border border-card-border/60 p-4">
      {/* Header with Channel Picker */}
      <div className="flex items-center justify-between pb-3 border-b border-card-border/40">
        <div>
          <h3 className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider">
            Power Spectral Density (PSD)
          </h3>
          <p className="text-[11px] font-mono text-zinc-500">
            Welch Periodogram Spectral Decomposition
          </p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-card-border/60 text-[10px] font-mono">
          <button
            onClick={() => setSelectedChannel(-1)}
            className={`px-2 py-0.5 rounded transition-colors ${
              selectedChannel === -1
                ? 'bg-zinc-800 text-neon-cyan font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            AVG
          </button>
          {channelNames.map((name, idx) => (
            <button
              key={name}
              onClick={() => setSelectedChannel(idx)}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedChannel === idx
                  ? 'bg-zinc-800 text-neon-cyan font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Spectral Band Power Bars */}
      <div className="flex flex-col gap-3 mt-4">
        {bands.map((b) => {
          const pct = Math.round(b.val * 100);
          return (
            <div key={b.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm inline-block"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="font-semibold text-zinc-200">{b.name}</span>
                  <span className="text-[10px] text-zinc-500">({b.range})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 hidden sm:inline">{b.desc}</span>
                  <span className="font-semibold text-zinc-200 w-10 text-right">{pct}%</span>
                </div>
              </div>

              {/* Progress track */}
              <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800/40">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    backgroundColor: b.color,
                    boxShadow: `0 0 8px ${b.color}44`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer info badge */}
      <div className="mt-auto pt-3 border-t border-card-border/40 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span>FFT Window: 256 samples (Hann)</span>
        <span className="text-neon-cyan">Resolution: 1.0 Hz/bin</span>
      </div>
    </div>
  );
};
