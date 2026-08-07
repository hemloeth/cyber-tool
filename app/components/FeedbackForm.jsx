'use client';

import React, { useState } from 'react';
import { MessageSquarePlus, Send, Loader2, Check } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';

export default function FeedbackForm() {
  const [showInput, setShowInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!feedbackText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule: feedbackText.trim(),
          category: 'User Response Feedback'
        })
      });

      if (res.ok) {
        setSaved(true);
        setFeedbackText('');
        setTimeout(() => {
          setSaved(false);
          setShowInput(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-2 border-t border-slate-700/30 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <button
          onClick={() => setShowInput(!showInput)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-400 transition-colors text-[11px]"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-purple-400" />
          <span>Correct / Train AI on this response</span>
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Enter correction rule (e.g. Careers form file upload fields should use POST)..."
            disabled={isSubmitting || saved}
            className="flex-1 bg-slate-950/80 text-xs text-slate-200 placeholder-slate-400 px-3 py-1.5 rounded-lg border border-slate-700 focus:border-cyan-500 outline-none font-sans"
          />
          <button
            type="submit"
            disabled={!feedbackText.trim() || isSubmitting || saved}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs disabled:opacity-40 transition-all font-semibold"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{saved ? 'Saved!' : 'Train'}</span>
          </button>
        </form>
      )}

      {saved && (
        <span className="text-[11px] text-emerald-400 font-mono">
          ✓ Rule saved to AI learning memory. The AI will apply this lesson to future prompts.
        </span>
      )}
    </div>
  );
}
