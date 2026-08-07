'use client';

import React, { useState } from 'react';
import { Terminal, Check, Copy } from 'lucide-react';

export default function CodeBlock({ language, codeText }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-700/60 bg-slate-950/90 shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <Terminal className="w-3.5 h-3.5" />
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-200 transition-colors"
          title="Copy snippet"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy Code'}</span>
        </button>
      </div>
      <pre className="p-3 text-xs text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}
