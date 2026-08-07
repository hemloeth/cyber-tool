'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';

export default function ChatInput({ onSendMessage, isLoading }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-6 pt-2">

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="relative glass-panel glass-panel-glow rounded-2xl p-2 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Cyber AI Brain anything (e.g. security architecture, Groq capabilities, code analysis)..."
          rows={1}
          disabled={isLoading}
          className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm px-3 py-2.5 outline-none resize-none min-h-[44px] max-h-[160px]"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-500/20"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
      
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 mt-2">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Powered by Groq API + Express Backend + MongoDB
        </span>
        <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Enter</kbd> to send</span>
      </div>

    </div>
  );
}
