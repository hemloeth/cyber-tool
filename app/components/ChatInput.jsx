'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

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
      <form onSubmit={handleSubmit} className="relative glass-panel glass-panel-hover rounded-xl p-2 flex items-end gap-2 border-slate-800">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a security question or paste code to audit..."
          rows={1}
          disabled={isLoading}
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm px-3 py-2.5 outline-none resize-none min-h-[44px] max-h-[160px]"
        />

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>
      </form>
      
      {/* Keyboard Shortcut Hint */}
      <div className="flex items-center justify-end text-[11px] text-slate-500 px-2 mt-2 font-mono">
        <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">Shift + Enter</kbd> for new line</span>
      </div>

    </div>
  );
}
