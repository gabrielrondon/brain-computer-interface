import React, { useState, useEffect, useRef } from 'react';
import { ArtifactStatus } from '@cortex-bci/core';

interface GhostTypeViewProps {
  artifacts: ArtifactStatus;
  onTriggerBlink: () => void;
}

export const GhostTypeView: React.FC<GhostTypeViewProps> = ({
  artifacts,
  onTriggerBlink,
}) => {
  const [text, setText] = useState<string>('');
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [selectedCol, setSelectedCol] = useState<number>(0);
  const [scanningMode, setScanningMode] = useState<'ROW' | 'COL'>('ROW');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const lastBlinkHandledRef = useRef<boolean>(false);

  const keyboardMatrix = [
    ['A', 'B', 'C', 'D', 'E', 'F'],
    ['G', 'H', 'I', 'J', 'K', 'L'],
    ['M', 'N', 'O', 'P', 'Q', 'R'],
    ['S', 'T', 'U', 'V', 'W', 'X'],
    ['Y', 'Z', 'SPACE', 'DELETE', 'CLEAR', 'SPEAK'],
  ];

  const quickPhrases = [
    'I need assistance, please.',
    'Thank you.',
    'I am feeling tired.',
    'Can I have some water?',
    'Yes.',
    'No.',
  ];

  // Automated matrix scanning ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (scanningMode === 'ROW') {
        setSelectedRow((r) => (r + 1) % keyboardMatrix.length);
      } else {
        setSelectedCol((c) => (c + 1) % keyboardMatrix[selectedRow].length);
      }
    }, 1200); // 1.2s scan interval

    return () => clearInterval(timer);
  }, [scanningMode, selectedRow]);

  // Handle Blink selection trigger
  useEffect(() => {
    if (artifacts.blink_detected && !lastBlinkHandledRef.current) {
      lastBlinkHandledRef.current = true;
      handleSelect();
    } else if (!artifacts.blink_detected) {
      lastBlinkHandledRef.current = false;
    }
  }, [artifacts.blink_detected]);

  const handleSelect = () => {
    if (scanningMode === 'ROW') {
      // Lock row, start scanning columns
      setScanningMode('COL');
      setSelectedCol(0);
    } else {
      // Lock column, select character
      const char = keyboardMatrix[selectedRow][selectedCol];
      handleAction(char);
      setScanningMode('ROW');
    }
  };

  const handleAction = (char: string) => {
    if (char === 'SPACE') {
      setText((t) => t + ' ');
    } else if (char === 'DELETE') {
      setText((t) => t.slice(0, -1));
    } else if (char === 'CLEAR') {
      setText('');
    } else if (char === 'SPEAK') {
      speakText(text);
    } else {
      setText((t) => t + char);
    }
  };

  const speakText = (phrase: string) => {
    if (!phrase || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header and Telemetry */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-semibold text-zinc-100 uppercase tracking-wider">
              GhostType: Assistive Neural Speller & Voice Synthesizer
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10">
              EOG Blink Trigger Active
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Row-column matrix scanning driven by intentional frontal blink impulses. Designed for motor impairment and ALS accessibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerBlink}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-medium text-neon-cyan border border-neon-cyan/40 transition-transform active:scale-95"
          >
            Trigger Selection Impulse (Blink)
          </button>
        </div>
      </div>

      {/* Composed Sentence Display & Voice Output */}
      <div className="p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-zinc-400 uppercase font-medium">
            Composed Sentence:
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            Scanning Mode: <strong className="text-neon-cyan">{scanningMode}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-lg font-mono text-zinc-100 min-h-[58px] flex items-center">
            {text || <span className="text-zinc-600 italic">Select letters to spell message...</span>}
            <span className="inline-block w-2 h-5 bg-neon-cyan ml-1 animate-pulse" />
          </div>

          <button
            onClick={() => speakText(text)}
            disabled={!text || isSpeaking}
            className="px-5 py-3.5 rounded-lg bg-neon-cyan/15 hover:bg-neon-cyan/25 text-neon-cyan border border-neon-cyan/40 text-xs font-mono font-bold transition-all disabled:opacity-40"
          >
            {isSpeaking ? 'Speaking...' : 'Speak (TTS)'}
          </button>
        </div>
      </div>

      {/* Main Keyboard Grid & Quick Phrases */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Scanning Matrix (8 cols) */}
        <div className="lg:col-span-8 p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-2">
          <span className="text-xs font-mono text-zinc-400 uppercase font-medium pb-1 border-b border-card-border/40">
            Matrix Keyboard Scanner
          </span>

          <div className="flex flex-col gap-2 mt-2">
            {keyboardMatrix.map((row, rIdx) => {
              const isRowActive = scanningMode === 'ROW' && selectedRow === rIdx;
              return (
                <div
                  key={rIdx}
                  className={`grid grid-cols-6 gap-2 p-1.5 rounded-lg transition-colors ${
                    isRowActive
                      ? 'bg-neon-cyan/15 border border-neon-cyan/50'
                      : 'bg-zinc-950/60 border border-zinc-900'
                  }`}
                >
                  {row.map((key, cIdx) => {
                    const isCellActive =
                      (scanningMode === 'COL' && selectedRow === rIdx && selectedCol === cIdx) ||
                      (scanningMode === 'ROW' && selectedRow === rIdx);

                    return (
                      <button
                        key={key}
                        onClick={() => handleAction(key)}
                        className={`h-12 rounded flex items-center justify-center font-mono text-xs font-semibold transition-all ${
                          isCellActive
                            ? 'bg-neon-cyan text-zinc-950 shadow-[0_0_12px_#00f2fe]'
                            : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Predictive Lexicon (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded-xl bg-card border border-card-border/60 flex flex-col gap-3">
          <span className="text-xs font-mono text-zinc-400 uppercase font-medium pb-1 border-b border-card-border/40">
            Rapid Phrases (1-Click)
          </span>

          <div className="flex flex-col gap-2">
            {quickPhrases.map((phrase) => (
              <button
                key={phrase}
                onClick={() => {
                  setText(phrase);
                  speakText(phrase);
                }}
                className="p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-left text-xs font-mono text-zinc-300 border border-zinc-800/80 transition-colors flex items-center justify-between"
              >
                <span>{phrase}</span>
                <span className="text-[10px] text-neon-cyan font-semibold">Speak</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
