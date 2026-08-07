'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function OfflineBanner({ isOffline }) {
  if (!isOffline) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <span>Express Backend server offline. Run <code className="font-mono bg-slate-900 px-1 py-0.5 rounded">cd backend && npm run dev</code> to connect Groq & MongoDB.</span>
    </div>
  );
}
