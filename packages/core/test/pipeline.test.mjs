import test from 'node:test';
import assert from 'node:assert/strict';
import { TsEegPipeline, TsBiquadFilter } from '../dist/index.js';
import { BiologicalSignalSimulator } from '../../simulator/dist/index.js';

test('TsBiquadFilter attenuates 50 Hz powerline mains interference', () => {
  const sampleRate = 256;
  const notch = TsBiquadFilter.notch(sampleRate, 50, 10);

  let maxIn = 0;
  let maxOut = 0;

  for (let i = 0; i < 500; i++) {
    const t = i / sampleRate;
    const input = Math.sin(2 * Math.PI * 50 * t);
    const output = notch.process(input);

    if (i > 250) {
      maxIn = Math.max(maxIn, Math.abs(input));
      maxOut = Math.max(maxOut, Math.abs(output));
    }
  }

  assert.ok(maxOut < 0.15, `Expected maxOut < 0.15, got ${maxOut}`);
});

test('TsEegPipeline processes multi-channel streaming and generates valid telemetry', () => {
  const pipeline = new TsEegPipeline(4, 256, 2048, 256);
  const sim = new BiologicalSignalSimulator({ sampleRate: 256, preset: 'ACTIVE_FOCUS' });

  // Feed 512 samples (2 seconds)
  for (let i = 0; i < 512; i++) {
    const frame = sim.nextFrame();
    pipeline.pushInterleavedFrame(frame);
  }

  const snapshot = pipeline.getTelemetrySnapshot(1000);

  assert.equal(snapshot.channels.length, 4);
  assert.ok(snapshot.cognitive.focus_index > 0);
  assert.ok(snapshot.cognitive.calm_index > 0);
  assert.ok(snapshot.artifacts.signal_quality > 0.5);

  // Focus preset should exhibit beta > alpha
  const ch0 = snapshot.channels[0];
  assert.ok(ch0.relative.beta > 0);
  assert.ok(ch0.absolute.total > 0);
});

test('BiologicalSignalSimulator injects frontal blink potentials', () => {
  const sim = new BiologicalSignalSimulator({ sampleRate: 256, blinkIntervalSeconds: 0 });
  sim.triggerBlink();

  let maxFrontalDeflection = 0;
  for (let i = 0; i < 60; i++) {
    const frame = sim.nextFrame();
    // AF7 and AF8 are channels 1 and 2
    maxFrontalDeflection = Math.max(maxFrontalDeflection, Math.abs(frame[1]));
  }

  assert.ok(maxFrontalDeflection > 90, `Blink peak should exceed 90 uV, got ${maxFrontalDeflection}`);
});
