'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, Check, Copy } from 'lucide-react';
import CodeBlock from './CodeBlock';
import SourcesBadgeList from './SourcesBadgeList';

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const sources = message.sources || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple formatter for paragraphs & code blocks
  const formatContent = (rawContent) => {
    if (!rawContent) return null;

    // Clean legacy technical strings if present
    const content = rawContent
      .replace(/⚠️\s*\*\*Strict OWASP Mode Active\*\*:\s*/gi, '')
      .replace(/\(?\s*CheatSheets,\s*WSTG,\s*API Security Top 10\)?\.?\s*/gi, '');

    // Split code blocks ```code```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0] || '';
        const hasLang = !firstLine.includes(' ') && firstLine.length < 15;
        const language = hasLang ? firstLine : 'text';
        const codeText = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

        return <CodeBlock key={idx} language={language} codeText={codeText} />;
      }

      // Regular text with line breaks
      return (
        <span key={idx} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </span>
      );
    });
  };

  return (
    <div className={`flex gap-3 my-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

      {/* Minimalist Avatar Icon */}
      <div className="flex-shrink-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${isUser
              ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
              : 'bg-zinc-900 border-zinc-800 text-emerald-400'
            }`}
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Message Bubble Container */}
      <div className={`max-w-[92%] sm:max-w-[85%] rounded-xl p-4 text-sm relative group transition-all ${isUser
          ? 'bg-zinc-800/80 border border-zinc-700/60 text-slate-100 rounded-tr-xs'
          : 'glass-panel text-slate-200 rounded-tl-xs'
        }`}>

        {/* Minimal Header inside bubble */}
        <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-slate-800/60 text-[11px] text-slate-400 font-mono">
          <span className="font-semibold tracking-wider text-slate-300">
            {isUser ? 'YOU' : 'SECURITY ASSISTANT'}
          </span>
          <div className="flex items-center gap-2">
            {message.timestamp && (
              <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-slate-200"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Message Content */}
        <div className="text-slate-200 text-sm">
          {formatContent(message.content)}
        </div>

        {/* Minimal References Section */}
        {!isUser && <SourcesBadgeList sources={sources} />}

      </div>

    </div>
  );
}
