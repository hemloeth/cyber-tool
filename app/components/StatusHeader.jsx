'use client';

import React from 'react';
import { ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';

export default function StatusHeader({ health, loadingHealth, onRefresh, onClearHistory, isClearing }) {
  const isBackendOnline = health?.status === 'online';
  const isDBConnected = health?.mongodb === 'connected' || health?.mongodb?.includes('connected');

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">Cyber Security Workspace</h1>
            <p className="text-[11px] text-slate-400">Security Audit & OWASP Guidance</p>
          </div>
        </div>

        {/* Minimalist Status Dots & Actions */}
        <div className="flex items-center gap-4 text-xs">
          
          {/* Status Dots */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5" title={`Backend Server: ${health?.status || 'checking'}`}>
              <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'}`} />
              <span>Server</span>
            </div>
            
            <div className="flex items-center gap-1.5" title={`Database: ${health?.mongodb || 'checking'}`}>
              <span className={`w-2 h-2 rounded-full ${isDBConnected ? 'bg-sky-500 shadow-sm shadow-sky-500/50' : 'bg-amber-500'}`} />
              <span>Database</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
            <button
              onClick={onRefresh}
              disabled={loadingHealth}
              title="Refresh status"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            <button
              onClick={onClearHistory}
              disabled={isClearing}
              title="Clear chat history"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-[11px] border border-slate-700/50 transition-colors"
            >
              <Trash2 className="w-3 h-3 text-slate-400" />
              <span>Clear</span>
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
