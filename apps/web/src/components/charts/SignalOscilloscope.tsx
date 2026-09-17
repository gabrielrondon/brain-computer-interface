import React, { useEffect, useRef, useState } from 'react';

interface SignalOscilloscopeProps {
  channelData: Float32Array[] | number[][];
  channelNames?: string[];
  sampleRate?: number;
  timeWindowSeconds?: number;
}

export const SignalOscilloscope: React.FC<SignalOscilloscopeProps> = ({
  channelData,
  channelNames = ['TP9', 'AF7', 'AF8', 'TP10'],
  sampleRate = 256,
  timeWindowSeconds = 3,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scaleUv, setScaleUv] = useState<number>(100); // +/- 100 uV per channel lane
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      if (!paused) {
        const width = canvas.width;
        const height = canvas.height;
        const numChannels = channelNames.length;
        const channelHeight = height / numChannels;

        // Clear canvas with dark slate tone
        ctx.fillStyle = '#0e0e11';
        ctx.fillRect(0, 0, width, height);

        // Draw vertical time grid lines (1-second intervals)
        const totalSamples = sampleRate * timeWindowSeconds;
        const pixelsPerSecond = width / timeWindowSeconds;

        ctx.strokeStyle = '#1e1e24';
        ctx.lineWidth = 1;

        for (let sec = 1; sec < timeWindowSeconds; sec++) {
          const x = sec * pixelsPerSecond;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }

        // Channel-specific neon color palette
        const colors = ['#00f2fe', '#4facfe', '#38bdf8', '#818cf8'];

        // Draw each channel lane
        for (let ch = 0; ch < numChannels; ch++) {
          const centerY = ch * channelHeight + channelHeight / 2;
          const data = channelData[ch] || [];
          const color = colors[ch % colors.length];

          // Horizontal zero-baseline
          ctx.strokeStyle = '#27272a';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(width, centerY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Lane separator
          ctx.strokeStyle = '#18181b';
          ctx.beginPath();
          ctx.moveTo(0, (ch + 1) * channelHeight);
          ctx.lineTo(width, (ch + 1) * channelHeight);
          ctx.stroke();

          // Waveform
          if (data.length > 1) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 4;
            ctx.beginPath();

            const n = Math.min(data.length, totalSamples);
            const startIdx = Math.max(0, data.length - n);
            const stepX = width / n;

            let minVal = Infinity;
            let maxVal = -Infinity;
            let latestVal = 0;

            for (let i = 0; i < n; i++) {
              const val = data[startIdx + i];
              if (val < minVal) minVal = val;
              if (val > maxVal) maxVal = val;
              latestVal = val;

              // Normalized Y position: centerY - (val / scaleUv) * (channelHeight / 2 * 0.8)
              const clampedVal = Math.max(-scaleUv, Math.min(scaleUv, val));
              const y = centerY - (clampedVal / scaleUv) * (channelHeight * 0.42);
              const x = i * stepX;

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow

            // Channel Telemetry Legend & P2P Readout
            const p2p = maxVal - minVal;
            ctx.fillStyle = '#71717a';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillText(
              `${channelNames[ch]}  ${latestVal >= 0 ? '+' : ''}${latestVal.toFixed(1)} uV  (p2p: ${p2p.toFixed(0)} uV)`,
              12,
              ch * channelHeight + 16
            );
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [channelData, channelNames, scaleUv, paused, sampleRate, timeWindowSeconds]);

  // Handle high-DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col w-full h-full rounded-xl bg-card border border-card-border/60 overflow-hidden">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-card-border/40 bg-zinc-900/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider">
            Time-Series Oscilloscope (4 Channels)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-neon-cyan">
            {sampleRate} Hz Real-time
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Voltage Scale Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-md border border-card-border/60 text-[11px] font-mono">
            {[50, 100, 200].map((scale) => (
              <button
                key={scale}
                onClick={() => setScaleUv(scale)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scaleUv === scale
                    ? 'bg-zinc-800 text-neon-cyan font-semibold'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                ±{scale}µV
              </button>
            ))}
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setPaused(!paused)}
            className={`px-2.5 py-0.5 text-[11px] font-mono rounded border transition-colors ${
              paused
                ? 'bg-neon-amber/10 border-neon-amber/40 text-neon-amber'
                : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {paused ? 'Resume' : 'Freeze'}
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative flex-1 w-full min-h-[280px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
