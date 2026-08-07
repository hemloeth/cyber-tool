'use client';

import React from 'react';
import { Cpu } from 'lucide-react';

export default function ThinkingIndicator({ isLoading }) {
  if (!isLoading) return null;

  return (
    <div className="flex gap-3 my-4">
      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
        <Cpu className="w-4 h-4 animate-spin" />
      </div>
      <div className="glass-panel rounded-2xl p-4 text-xs text-slate-400 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
        Cyber AI Brain is processing request with Groq LLM...
      </div>
    </div>
  );
}
