'use client';

import React from 'react';
import { ShieldCheck, BookOpen } from 'lucide-react';

export default function SourcesBadgeList({ sources = [] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-2 border-t border-slate-700/40 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-cyan-400 flex items-center gap-1 font-semibold">
        <ShieldCheck className="w-3.5 h-3.5" />
        OWASP Sources:
      </span>
      {sources.map((src, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono flex items-center gap-1"
        >
          <BookOpen className="w-3 h-3 text-cyan-400" />
          {src.source.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}
