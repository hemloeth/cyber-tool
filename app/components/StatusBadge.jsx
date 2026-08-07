'use client';

import React from 'react';

export default function StatusBadge({ icon: Icon, label, status }) {
  const getBadgeStyle = (val) => {
    if (val === 'connected' || val === 'configured' || val === 'online' || val === 'indexed') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (val?.includes('memory') || val?.includes('demo')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${getBadgeStyle(status)}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      <span>{label}: <strong className="font-mono">{status || 'checking...'}</strong></span>
    </div>
  );
}
