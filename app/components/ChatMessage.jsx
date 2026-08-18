'use client';

import React, { useState } from 'react';
import { User, ShieldCheck, Check, Copy } from 'lucide-react';
import CodeBlock from './CodeBlock';
import SourcesBadgeList from './SourcesBadgeList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatMessage({ message, hideAvatar }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const sources = message.sources || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean legacy technical strings if present
  const cleanContent = (rawContent) => {
    if (!rawContent) return '';
    return rawContent
      .replace(/⚠️\s*\*\*Strict OWASP Mode Active\*\*:\s*/gi, '')
      .replace(/\(?\s*CheatSheets,\s*WSTG,\s*API Security Top 10\)?\.?\s*/gi, '');
  };

  return (
    <div className={`flex gap-3 my-4 ${isUser ? 'flex-col items-end' : 'flex-row'}`}>

      {/* Minimalist Avatar Icon (Only for Assistant) */}
      {!hideAvatar && !isUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border text-xs bg-zinc-900 border-zinc-800 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`w-full rounded-2xl p-4 text-sm relative group transition-all ${isUser
          ? 'bg-[#0f1a26] border border-[#1e2e42] text-slate-200'
          : 'text-slate-200 bg-transparent'
        }`}>

        {/* Minimal Header inside bubble (Only for Assistant) */}
        {!isUser && !hideAvatar && (
          <div className="flex items-center justify-between gap-4 mb-3 pb-1 border-b border-slate-800/60 text-[11px] text-slate-400 font-mono">
            <span className="font-semibold tracking-wider text-slate-300">SECURITY ASSISTANT</span>
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
        )}

        {/* Message Content with Advanced Markdown Rendering */}
        <div className="text-slate-200 text-[13.5px] leading-relaxed">
          {isUser ? (
            <span className="whitespace-pre-wrap">{cleanContent(message.content)}</span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-slate-100 mt-6 mb-3 border-b border-slate-800 pb-2" {...props}/>,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold text-emerald-400 mt-5 mb-2" {...props}/>,
                h3: ({node, ...props}) => <h3 className="text-base font-semibold text-slate-200 mt-4 mb-2" {...props}/>,
                p: ({node, ...props}) => <p className="mb-3 leading-relaxed" {...props}/>,
                ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5" {...props}/>,
                ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5" {...props}/>,
                li: ({node, ...props}) => <li className="text-slate-300" {...props}/>,
                a: ({node, ...props}) => <a className="text-cyan-400 hover:text-cyan-300 hover:underline" target="_blank" rel="noopener noreferrer" {...props}/>,
                strong: ({node, ...props}) => <strong className="font-semibold text-slate-100" {...props}/>,
                code({node, inline, className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <div className="my-4">
                      <CodeBlock language={match[1]} codeText={String(children).replace(/\n$/, '')} />
                    </div>
                  ) : (
                    <code className="bg-slate-800/80 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-[12px] border border-slate-700/50" {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {cleanContent(message.content)}
            </ReactMarkdown>
          )}
        </div>

        {/* Minimal References Section */}
        {!isUser && <SourcesBadgeList sources={sources} />}

      </div>

    </div>
  );
}
