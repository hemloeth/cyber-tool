'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, Mic, ShieldCheck, ChevronDown, ChevronUp, Lock, Cookie, KeyRound, ScanLine, LogIn } from 'lucide-react';

export default function ChatInput({ onSendMessage, isLoading }) {
  const [input, setInput] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authType, setAuthType] = useState('none');
  const [authFields, setAuthFields] = useState({ cookies: '', loginUrl: '', username: '', password: '' });
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const looksLikeUrl = /https?:\/\/|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(input.trim());
  const hasAuth = authType !== 'none';

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    let auth = null;
    if (authType === 'cookie' && authFields.cookies.trim()) {
      auth = { type: 'cookie', cookies: authFields.cookies.trim() };
    } else if (authType === 'login' && authFields.loginUrl.trim()) {
      auth = { type: 'login', loginUrl: authFields.loginUrl.trim(), username: authFields.username, password: authFields.password };
    } else if (authType === 'basic' && authFields.username.trim()) {
      auth = { type: 'basic', username: authFields.username, password: authFields.password };
    }
    onSendMessage(input.trim(), auth);
    setInput('');
    setShowAuth(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const updateField = (key, value) => setAuthFields(prev => ({ ...prev, [key]: value }));
  const fieldCls = 'w-full bg-[#0a1220] border border-slate-700/60 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 text-xs outline-none focus:border-emerald-500/60 transition-colors';

  const authTypeBtnCls = (type) =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
      authType === type
        ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
        : 'bg-[#0a1220] border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600'
    }`;

  return (
    <div className='w-full px-2 pb-4 pt-2'>

      {/* Auth Panel — slides open above the input */}
      {showAuth && (
        <div className='mb-2 bg-[#0b1222] border border-slate-700/50 rounded-xl p-3 space-y-2.5 animate-in slide-in-from-bottom-2 duration-200'>
          <div className='flex items-center justify-between'>
            <span className='text-[11px] font-semibold text-slate-300 flex items-center gap-1.5'>
              <ShieldCheck className='w-3.5 h-3.5 text-emerald-400' />
              Authenticated Scan
            </span>
            <button
              type='button'
              onClick={() => { setShowAuth(false); setAuthType('none'); }}
              className='text-[10px] text-slate-500 hover:text-red-400 transition-colors'
            >
              Clear & Close
            </button>
          </div>

          {/* Auth type selector */}
          <div className='flex gap-2'>
            <button type='button' className={authTypeBtnCls('cookie')} onClick={() => setAuthType('cookie')}>
              <Cookie className='w-3 h-3' /> Session Cookie
            </button>
            <button type='button' className={authTypeBtnCls('login')} onClick={() => setAuthType('login')}>
              <LogIn className='w-3 h-3' /> Form Login
            </button>
            <button type='button' className={authTypeBtnCls('basic')} onClick={() => setAuthType('basic')}>
              <KeyRound className='w-3 h-3' /> HTTP Basic
            </button>
          </div>

          {/* Dynamic auth fields based on type */}
          {authType === 'cookie' && (
            <div className='space-y-1.5'>
              <label className='text-[10px] text-slate-500'>Cookie Header String</label>
              <input
                type='text'
                value={authFields.cookies}
                onChange={(e) => updateField('cookies', e.target.value)}
                placeholder='sessionid=abc123; csrftoken=xyz789; ...'
                className={fieldCls}
              />
              <p className='text-[9px] text-slate-600'>Paste the full cookie string from your browser DevTools → Application → Cookies</p>
            </div>
          )}

          {authType === 'login' && (
            <div className='space-y-1.5'>
              <label className='text-[10px] text-slate-500'>Login Page URL</label>
              <input
                type='text'
                value={authFields.loginUrl}
                onChange={(e) => updateField('loginUrl', e.target.value)}
                placeholder='https://target.com/login'
                className={fieldCls}
              />
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='text-[10px] text-slate-500'>Username / Email</label>
                  <input
                    type='text'
                    value={authFields.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder='admin'
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className='text-[10px] text-slate-500'>Password</label>
                  <input
                    type='password'
                    value={authFields.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder='••••••••'
                    className={fieldCls}
                  />
                </div>
              </div>
              <p className='text-[9px] text-slate-600'>Playwright will auto-login, capture session cookies, and share them with all scan tools</p>
            </div>
          )}

          {authType === 'basic' && (
            <div className='space-y-1.5'>
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='text-[10px] text-slate-500'>Username</label>
                  <input
                    type='text'
                    value={authFields.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder='admin'
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className='text-[10px] text-slate-500'>Password</label>
                  <input
                    type='password'
                    value={authFields.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder='••••••••'
                    className={fieldCls}
                  />
                </div>
              </div>
              <p className='text-[9px] text-slate-600'>Used for HTTP Basic Authentication (Authorization header)</p>
            </div>
          )}

          {authType !== 'none' && (
            <div className='flex items-center gap-1.5 pt-1'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
              <span className='text-[10px] text-emerald-400/80'>
                {authType === 'cookie' ? 'Cookies will be injected into all tools' :
                 authType === 'login' ? 'Playwright will login first, then share cookies with all tools' :
                 'Authorization header will be sent to all tools'}
              </span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className='relative bg-[#0d1623] border border-slate-700/60 rounded-2xl flex flex-col p-2 shadow-lg'>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ask anything, or paste a URL to scan...'
          rows={1}
          disabled={isLoading}
          className='w-full bg-transparent text-slate-200 placeholder-slate-500 text-[13px] px-2 py-1 outline-none resize-none min-h-[36px] max-h-[160px]'
        />
        <div className='flex items-center justify-between px-1 pt-1.5 pb-1'>
          <div className='flex items-center gap-2'>
            {/* Auth toggle button */}
            <button
              type='button'
              onClick={() => setShowAuth(!showAuth)}
              title={showAuth ? 'Hide auth options' : 'Add authentication for scan'}
              className={`flex items-center justify-center w-7 h-7 rounded-full transition-all ${
                hasAuth
                  ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/40'
                  : showAuth
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-[#1e293b] text-slate-500 hover:text-slate-200'
              }`}
            >
              <Lock className='w-3.5 h-3.5' />
            </button>
            <span className='text-[10px] text-slate-600'>
              {hasAuth ? `🔐 ${authType}` : 'Enter to send'}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            {!input.trim() ? (
              <button type='button' className='flex items-center justify-center w-7 h-7 rounded-full bg-[#1e293b] text-slate-400 hover:text-slate-200 transition-colors'>
                <Mic className='w-3.5 h-3.5' />
              </button>
            ) : looksLikeUrl ? (
              <button type='submit' disabled={isLoading} className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40 transition-all'>
                {isLoading ? <><Loader2 className='w-3.5 h-3.5 animate-spin' /> Scanning...</> : <><ScanLine className='w-3.5 h-3.5' /> {hasAuth ? 'Auth Scan' : 'Start Scan'}</>}
              </button>
            ) : (
              <button type='submit' disabled={isLoading} className='flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-all'>
                {isLoading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <ArrowUp className='w-3.5 h-3.5' />}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
