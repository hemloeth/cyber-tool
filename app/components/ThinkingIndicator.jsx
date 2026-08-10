'use client';

import React from 'react';

export default function ThinkingIndicator({ isLoading }) {
  if (!isLoading) return null;

  return (
    <div className="flex items-center gap-3 my-4 pl-1">
      <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-zinc-700/50 text-slate-400 flex items-center justify-center text-[10px]">
        <div className="flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-slate-400 animate-ping"></span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
        </div>
        <span>Analyzing request...</span>
      </div>
    </div>
  );
}
