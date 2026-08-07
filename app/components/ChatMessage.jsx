'use client';

import React, { useState } from 'react';
import { Cpu, User, Check, Copy } from 'lucide-react';
import CodeBlock from './CodeBlock';
import SourcesBadgeList from './SourcesBadgeList';
import FeedbackForm from './FeedbackForm';
import DiscoveredInputsCards from './DiscoveredInputsCards';

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const sources = message.sources || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if content contains structured JSON endpoint data
  const tryParseJSON = (raw) => {
    if (!raw) return null;
    try {
      // Find JSON block if wrapped in markdown ```json ... ``` or raw JSON
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || [null, raw];
      const parsed = JSON.parse(jsonMatch[1] || raw);
      if (parsed && (parsed.discoveredInputs || parsed.pagesAnalyzed || parsed.endpointsWithInputs)) {
        return parsed;
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const parsedCardData = !isUser ? tryParseJSON(message.content) : null;

  // Simple formatter for paragraphs & code blocks
  const formatContent = (rawContent) => {
    if (!rawContent) return null;

    // Clean legacy technical strings
    const content = rawContent
      .replace(/⚠️\s*\*\*Strict OWASP Mode Active\*\*:\s*/gi, '')
      .replace(/\(?\s*CheatSheets,\s*WSTG,\s*API Security Top 10\)?\.?\s*/gi, '');

    // If content is purely structured JSON endpoint discovery, render visually
    if (parsedCardData) {
      return <DiscoveredInputsCards data={parsedCardData} />;
    }

    // Split code blocks ```code```
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0] || '';
        const hasLang = !firstLine.includes(' ') && firstLine.length < 15;
        const language = hasLang ? firstLine : 'text';
        const codeText = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

        // Check if code block contains JSON endpoint data
        try {
          const parsedSnippet = JSON.parse(codeText);
          if (parsedSnippet && (parsedSnippet.discoveredInputs || parsedSnippet.pagesAnalyzed || parsedSnippet.endpointsWithInputs)) {
            return <DiscoveredInputsCards key={idx} data={parsedSnippet} />;
          }
        } catch (e) { }

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

      {/* Avatar Icon */}
      <div className="flex-shrink-0">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-md ${isUser
              ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
              : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-cyan-500/10'
            }`}
        >
          {isUser ? <User className="w-4 h-4" /> : <Cpu className="w-4 h-4 animate-pulse" />}
        </div>
      </div>

      {/* Message Bubble Container */}
      <div className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 text-sm relative group ${isUser
          ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-50 rounded-tr-xs'
          : 'glass-panel text-slate-100 rounded-tl-xs'
        }`}>

        {/* Header bar inside bubble */}
        <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-slate-700/30 text-[11px] text-slate-400 font-mono">
          <span className="font-semibold tracking-wide text-slate-300">
            {isUser ? 'USER' : 'CYBER AI BRAIN'}
          </span>
          <div className="flex items-center gap-2">
            {message.timestamp && (
              <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-slate-200"
              title="Copy message"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="text-slate-200 text-sm">
          {formatContent(message.content)}
        </div>

        {/* Referenced OWASP Sources Badge Bar */}
        {!isUser && <SourcesBadgeList sources={sources} />}

        {/* Feedback / Train AI Action Bar */}
        {!isUser && <FeedbackForm />}

      </div>

    </div>
  );
}
