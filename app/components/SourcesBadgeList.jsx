'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';

export default function SourcesBadgeList({ sources = [] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
      <span className="flex items-center gap-1 text-slate-300 font-semibold">
        <BookOpen className="w-3 h-3 text-sky-400" />
        References:
      </span>
      {sources.map((src, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50"
        >
          {src.source.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}
