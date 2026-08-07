'use client';

import React from 'react';
import { Cpu, Database, Server, RefreshCw, Trash2, Sparkles, BookOpen } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function StatusHeader({ health, loadingHealth, onRefresh, onClearHistory, isClearing }) {
  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800 px-4 py-3 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 p-[1px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight cyber-gradient-text">CYBER AI BRAIN</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Phase 1 v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Groq LLM Engine & MongoDB Persistent Memory
            </p>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Express Backend Status */}
          <StatusBadge icon={Server} label="Backend" status={health?.status} />

          {/* MongoDB Status */}
          <StatusBadge icon={Database} label="MongoDB" status={health?.mongodb} />

          {/* Groq AI Status */}
          <StatusBadge icon={Cpu} label="Groq" status={health?.groq} />

          {/* OWASP Knowledge Base Status */}
          {health?.owaspKnowledgeBase && (
            <StatusBadge icon={BookOpen} label="OWASP Knowledge" status={`${health.owaspKnowledgeBase.chunksIndexed} chunks`} />
          )}

          {/* Refresh & Clear Actions */}
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={onRefresh}
              disabled={loadingHealth}
              title="Refresh Backend Health"
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              onClick={onClearHistory}
              disabled={isClearing}
              title="Clear Chat History"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
