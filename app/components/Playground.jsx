'use client';

import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, CheckCircle, Bug, Link as LinkIcon, Database, Terminal, BrainCircuit, Flame, Globe, Search, Radar, Cpu, Eye, Zap, Shield, Clock, ChevronDown, ChevronUp, Lock, XCircle, AlertTriangle } from 'lucide-react';
import ChatMessage from './ChatMessage';

const SCAN_TOOLS = [
  { id: 'katana',     label: 'Katana',       desc: 'Web crawler — discovering URLs & endpoints',        icon: Globe,   color: 'text-cyan-400',    bar: 'bg-cyan-500',    delay: 0    },
  { id: 'gospider',  label: 'GoSpider',      desc: 'Spider crawling JS files & sitemaps',               icon: Search,  color: 'text-blue-400',    bar: 'bg-blue-500',    delay: 400  },
  { id: 'hakrawler', label: 'Hakrawler',     desc: 'Endpoint & hidden path discovery',                  icon: Radar,   color: 'text-indigo-400',  bar: 'bg-indigo-500',  delay: 800  },
  { id: 'arjun',     label: 'Arjun',         desc: 'HTTP parameter discovery (passive)',                 icon: Cpu,     color: 'text-violet-400',  bar: 'bg-violet-500',  delay: 1200 },
  { id: 'playwright',label: 'Playwright',    desc: 'Headless browser — crawling & form analysis',       icon: Eye,     color: 'text-purple-400',  bar: 'bg-purple-500',  delay: 1600 },
  { id: 'dalfox',    label: 'Dalfox',        desc: 'Reflected & verified XSS fuzzing',                  icon: Zap,     color: 'text-rose-400',    bar: 'bg-rose-500',    delay: 2200 },
  { id: 'storedxss', label: 'Stored XSS',   desc: 'Canary marker injection & persistence check',       icon: Flame,   color: 'text-orange-400',  bar: 'bg-orange-500',  delay: 2800 },
];

function ToolStatusRow({ tool, isDone, isActive, isPending, scanData }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = tool.icon;

  // Extract tool results if available
  let toolData = null;
  let count = 0;
  if (scanData?.scanners) {
    const s = scanData.scanners;
    if (tool.id === 'katana') { toolData = s.katana?.urls || []; count = s.katana?.count || toolData.length; }
    else if (tool.id === 'gospider') { toolData = s.gospider?.urls || []; count = s.gospider?.count || toolData.length; }
    else if (tool.id === 'hakrawler') { toolData = s.hakrawler?.urls || []; count = s.hakrawler?.count || toolData.length; }
    else if (tool.id === 'arjun') { toolData = s.arjun?.params || []; count = s.arjun?.count || toolData.length; }
    else if (tool.id === 'playwright') { toolData = s.playwright?.urls || []; count = s.playwright?.count || toolData.length; }
    else if (tool.id === 'dalfox') { toolData = s.dalfox?.findings || []; count = s.dalfox?.totalFindings || toolData.length; }
    else if (tool.id === 'storedxss') { toolData = s.storedXss?.findings || []; count = s.storedXss?.totalFindings || toolData.length; }
  }

  const isClickable = isDone || (scanData && toolData);

  return (
    <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${
      isActive
        ? 'bg-[#0d1c2e] border-emerald-500/40 shadow-lg shadow-emerald-500/5'
        : isDone
        ? 'bg-[#0a1520]/80 border-slate-800/80 hover:border-slate-600'
        : 'bg-[#090d16]/40 border-slate-800/30 opacity-40'
    }`}>
      {/* Header */}
      <div
        onClick={() => isClickable && setIsOpen(!isOpen)}
        className={`flex items-center gap-3 px-4 py-3 select-none ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isActive ? 'bg-emerald-500/15 border border-emerald-500/30' :
          isDone   ? 'bg-slate-800/60' : 'bg-slate-900/40'
        }`}>
          <Icon className={`w-4 h-4 ${isActive ? tool.color : isDone ? 'text-slate-300' : 'text-slate-700'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isActive ? 'text-slate-100' : isDone ? 'text-slate-200' : 'text-slate-600'}`}>
              {tool.label}
            </span>
            {isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                Running
              </span>
            )}
            {isDone && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-semibold uppercase tracking-wider border border-slate-700/80 flex items-center gap-1">
                DONE {count > 0 && <span className="text-slate-300">({count})</span>}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{tool.desc}</p>
          {isActive && (
            <div className="mt-2 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${tool.bar} rounded-full animate-scan-progress`}
                style={{ animation: 'scanProgress 2s ease-in-out infinite' }} />
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isDone && <CheckCircle className="w-4 h-4 text-emerald-500" />}
          {isActive && <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />}
          {isPending && <div className="w-4 h-4 rounded-full border border-slate-700" />}
          {isClickable && (
            <div className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center gap-1 text-xs">
              <span>{isOpen ? 'Hide' : 'Results'}</span>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}
        </div>
      </div>

      {/* Drawer */}
      {isOpen && isClickable && (
        <div className="p-4 bg-[#070b12] border-t border-slate-800/80 text-xs font-mono text-slate-300">
          {Array.isArray(toolData) && toolData.length > 0 ? (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {toolData.map((item, idx) => (
                <li key={idx} className="break-all py-1.5 px-3 rounded bg-slate-900/80 border border-slate-800/60 hover:border-slate-700 transition">
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 italic font-sans">No items or findings retrieved by this tool.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ScanLoadingScreen({ target, scanData }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timers = SCAN_TOOLS.map((tool, idx) =>
      setTimeout(() => {
        setActiveIdx(idx);
      }, tool.delay)
    );
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => { timers.forEach(clearTimeout); clearInterval(interval); };
  }, []);

  const progress = Math.min(Math.round(((activeIdx + 1) / SCAN_TOOLS.length) * 100), 99);
  const displayTarget = target || 'Target';
  const elapsed = tick;
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed/60)}m ${elapsed%60}s`;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6 custom-scrollbar">

      {/* Top header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Active Security Scan</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-500">Elapsed: {elapsedStr}</span>
            </div>
          </div>
        </div>

        {/* Target URL pill */}
        <div className="mt-3 flex items-center gap-2 bg-[#0d1c2e] border border-emerald-500/20 rounded-xl px-4 py-2.5">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-emerald-300 font-mono text-sm break-all">{displayTarget}</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Overall Progress</span>
          <span className="text-xs font-bold text-emerald-400">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase label */}
      <div className="mb-4">
        {activeIdx <= 4 && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 font-semibold uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Phase 1 — Reconnaissance & Discovery
          </div>
        )}
        {activeIdx === 5 && (
          <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Phase 2 — Reflected XSS Detection (Dalfox)
          </div>
        )}
        {activeIdx === 6 && (
          <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold uppercase tracking-wider">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            Phase 3 — Stored XSS Canary Injection & Verification
          </div>
        )}
      </div>

      {/* Tool status rows with click expand feature */}
      <div className="flex flex-col gap-2">
        {SCAN_TOOLS.map((tool, idx) => {
          const isDone = idx < activeIdx;
          const isActive = idx === activeIdx;
          const isPending = idx > activeIdx;

          return (
            <ToolStatusRow
              key={tool.id}
              tool={tool}
              isDone={isDone}
              isActive={isActive}
              isPending={isPending}
              scanData={scanData}
            />
          );
        })}
      </div>

      {/* Bottom note */}
      <p className="mt-6 text-center text-xs text-slate-600 italic">
        This may take 2–5 minutes depending on target complexity and tool availability.
      </p>
    </div>
  );
}

function ToolAccordionItem({ title, count, items, icon: Icon, color }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-800 bg-[#0a101a] rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-[#0d1624] hover:bg-[#121e30] transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="font-semibold text-slate-200 text-sm">{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            {count} {count === 1 ? 'result' : 'results'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 text-xs">
          <span>{isOpen ? 'Hide' : 'Show'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-[#070b12] border-t border-slate-800/80 text-xs font-mono text-slate-300">
          {items && items.length > 0 ? (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {items.map((item, idx) => (
                <li key={idx} className="break-all py-1 px-2 rounded bg-slate-900/60 border border-slate-800/50 hover:border-slate-700 transition">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 italic font-sans">No output or items retrieved by this tool.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Playground({ scanData, aiMessage, isLoading, scanningTarget }) {
  if (isLoading) {
    return <ScanLoadingScreen target={scanningTarget} scanData={scanData} />;
  }

  if (!scanData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500">
        <Terminal className="w-16 h-16 mb-4 opacity-20" />
        <h3 className="text-lg font-medium text-slate-400">Security Playground</h3>
        <p className="mt-2 text-sm text-center max-w-sm">
          Ask the assistant to scan a URL (e.g. "scan https://example.com"). The detailed vulnerability analysis and recon data will appear here.
        </p>
      </div>
    );
  }

  const { domain, scanners, unifiedResults, success, error, authVerification } = scanData;

  if (!success) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl m-4">
        <div className="flex items-center gap-3 text-red-400 mb-2">
          <ShieldAlert className="w-6 h-6" />
          <h3 className="text-lg font-semibold">Scan Failed</h3>
        </div>
        <p className="text-sm text-red-300">{error || 'An unknown error occurred during scanning.'}</p>
      </div>
    );
  }

  const df = scanners?.dalfox;
  const sx = scanners?.storedXss;
  const hasXSS = df && df.totalFindings > 0;
  const hasStoredXSS = sx && sx.totalFindings > 0;

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 custom-scrollbar">
      
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
          Scan Results
        </h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
          <span className="bg-slate-800 px-2 py-1 rounded text-slate-300">{domain}</span>
        </div>
      </div>

      {/* Auth Verification Card */}
      {authVerification && (
        <div className={`mb-6 rounded-xl border p-4 ${
          authVerification.status === 'success' || authVerification.status === 'provided'
            ? 'bg-emerald-950/30 border-emerald-500/30'
            : authVerification.status === 'failed' || authVerification.status === 'error'
            ? 'bg-red-950/30 border-red-500/30'
            : 'bg-amber-950/30 border-amber-500/30'
        }`}>
          <div className='flex items-center gap-2 mb-3'>
            <Lock className={`w-4 h-4 ${
              authVerification.status === 'success' || authVerification.status === 'provided'
                ? 'text-emerald-400'
                : authVerification.status === 'failed' || authVerification.status === 'error'
                ? 'text-red-400'
                : 'text-amber-400'
            }`} />
            <h3 className='text-sm font-bold text-slate-200'>Authentication Verification</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              authVerification.status === 'success' || authVerification.status === 'provided'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : authVerification.status === 'failed' || authVerification.status === 'error'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {authVerification.status === 'success' ? '✅ Logged In' :
               authVerification.status === 'provided' ? '🍪 Cookies Set' :
               authVerification.status === 'configured' ? '🔑 Configured' :
               authVerification.status === 'failed' ? '❌ Failed' :
               authVerification.status === 'no_cookies' ? '⚠️ No Cookies' :
               '❌ Error'}
            </span>
          </div>

          <p className='text-xs text-slate-300 mb-3'>{authVerification.message}</p>

          <div className='grid grid-cols-1 gap-2 text-xs'>
            {authVerification.loginUrl && (
              <div className='flex gap-2'>
                <span className='text-slate-500 shrink-0'>Login URL:</span>
                <span className='text-slate-300 font-mono break-all'>{authVerification.loginUrl}</span>
              </div>
            )}
            {authVerification.postLoginUrl && (
              <div className='flex gap-2'>
                <span className='text-slate-500 shrink-0'>After Login:</span>
                <span className='text-emerald-300 font-mono break-all'>{authVerification.postLoginUrl}</span>
              </div>
            )}
            {authVerification.postLoginTitle && (
              <div className='flex gap-2'>
                <span className='text-slate-500 shrink-0'>Page Title:</span>
                <span className='text-slate-300'>"{authVerification.postLoginTitle}"</span>
              </div>
            )}
            {authVerification.cookieNames && authVerification.cookieNames.length > 0 && (
              <div className='flex gap-2 flex-wrap items-start'>
                <span className='text-slate-500 shrink-0'>Cookies ({authVerification.cookieCount}):</span>
                <div className='flex flex-wrap gap-1'>
                  {authVerification.cookieNames.map((name, i) => (
                    <span key={i} className='px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[10px]'>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Post-login screenshot proof */}
          {authVerification.screenshot && (
            <div className='mt-3'>
              <p className='text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider font-semibold'>Post-Login Screenshot (Proof)</p>
              <img
                src={authVerification.screenshot}
                alt='Post-login page screenshot'
                className='w-full max-h-48 object-contain object-left-top rounded-lg border border-slate-700/60 bg-white'
              />
            </div>
          )}
        </div>
      )}

      {/* AI Analysis Text Response */}
      {aiMessage && (
        <div className="mb-8 relative group">
          <h3 className="text-lg font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-400" />
            AI Vulnerability Analysis
          </h3>
          <div className="-mx-4 px-4 bg-purple-900/10 border-y border-purple-500/20">
            <ChatMessage message={aiMessage} hideAvatar={true} />
          </div>
        </div>
      )}

      {/* Dalfox XSS Vulnerabilities (Highest Priority) */}
      {df && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Bug className="w-5 h-5 text-rose-400" />
            Dalfox XSS Findings
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 ml-2">
              Tested {df.urlsScanned} URLs
            </span>
          </h3>

          {!hasXSS ? (
            <div className="bg-[#0f1a26] border border-[#1e2e42] rounded-xl p-5 flex flex-col items-center justify-center text-emerald-400">
              <CheckCircle className="w-8 h-8 mb-2" />
              <span className="font-medium text-lg">No XSS vulnerabilities found.</span>
              <span className="text-sm text-slate-400 mt-1">The application appears resilient to the tested XSS payloads.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Summary Badges */}
              <div className="flex gap-4">
                <div className="px-4 py-2 rounded-lg bg-rose-900/30 border border-rose-500/30 text-rose-400 text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  {df.verified} Verified Exploits
                </div>
                <div className="px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-500/30 text-amber-400 text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {df.reflected} Potential Reflections
                </div>
              </div>

              {/* Vulnerability Cards */}
              {df.findings.map((finding, idx) => (
                <div key={idx} className="bg-[#0a101a] border-l-4 border-l-rose-500 border border-[#1e2e42] rounded-xl p-5 shadow-lg relative overflow-hidden">
                  
                  {/* Subtle red glow in the background */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl"></div>

                  {/* Card Header */}
                  <div className="flex justify-between items-center mb-5 border-b border-slate-800/60 pb-3">
                    <span className="font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                      <Bug className="w-4 h-4" />
                      {finding.type || 'Vulnerability'}
                    </span>
                    {finding.severity && (
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-rose-950 border border-rose-900/80 text-rose-300 font-bold uppercase tracking-wider">
                        {finding.severity}
                      </span>
                    )}
                  </div>
                  
                  {/* Vertical Data Stack */}
                  <div className="flex flex-col gap-4 text-sm relative z-10">
                    
                    {/* Full Exploit URL Block */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-slate-400 font-semibold text-[12px] uppercase tracking-wider">Exploit URL (Proof of Concept)</span>
                      <div className="w-full bg-rose-950/40 text-rose-300 border border-rose-500/40 p-3.5 rounded-lg break-all font-mono text-[13px] leading-relaxed shadow-inner">
                        {(() => {
                          const poc = finding.poc || '';
                          if (poc.startsWith('http')) return poc;
                          const base = finding.url || finding.inject_url || df.targetUrl || '';
                          const payload = finding.payload || '';
                          const param = finding.param ? `?${finding.param}=` : '';
                          // Only append if it doesn't already contain the payload
                          if (base.includes(payload)) return base;
                          return `${base}${base.includes('?') ? '&' : (param ? '' : '?')}${param}${encodeURIComponent(payload)}`;
                        })()}
                      </div>
                    </div>

                    {/* The Param & Evidence Block was removed to keep the UI clean */}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stored XSS Canary Findings */}
      {sx && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Stored XSS Canary Findings
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 ml-2">
              {sx.formsSubmitted} forms injected · {sx.pagesVerified} pages verified
            </span>
          </h3>

          {!hasStoredXSS ? (
            <div className="bg-[#0f1a26] border border-[#1e2e42] rounded-xl p-5 flex flex-col items-center justify-center text-emerald-400">
              <CheckCircle className="w-8 h-8 mb-2" />
              <span className="font-medium text-lg">No Stored XSS vulnerabilities found.</span>
              <span className="text-sm text-slate-400 mt-1">Canary markers were not detected persisting across page loads.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="px-4 py-2 rounded-lg bg-orange-900/30 border border-orange-500/30 text-orange-400 text-sm font-semibold flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  {sx.totalFindings} Stored XSS {sx.totalFindings === 1 ? 'Finding' : 'Findings'}
                </div>
              </div>

              {sx.findings.map((finding, idx) => {
                const contextColors = {
                  html_body: 'bg-orange-950 border-orange-900/80 text-orange-300',
                  html_attribute: 'bg-yellow-950 border-yellow-900/80 text-yellow-300',
                  js_variable: 'bg-red-950 border-red-900/80 text-red-300',
                };
                const ctxCls = contextColors[finding.context] || contextColors.html_body;
                const ctxLabel = {
                  html_body: 'HTML Body',
                  html_attribute: 'HTML Attribute',
                  js_variable: 'JS Variable',
                }[finding.context] || finding.context;

                return (
                  <div key={idx} className="bg-[#0a101a] border-l-4 border-l-orange-500 border border-[#1e2e42] rounded-xl p-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl" />

                    <div className="flex justify-between items-center mb-4 border-b border-slate-800/60 pb-3">
                      <span className="font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <Flame className="w-4 h-4" /> Stored XSS
                      </span>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider ${ctxCls}`}>
                        {ctxLabel}
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Injection Point</span>
                        <div className="bg-orange-950/40 text-orange-300 border border-orange-500/30 p-3 rounded-lg font-mono text-[12px] break-all">
                          <span className="text-slate-400">param: </span>{finding.injectionParam}<br />
                          <span className="text-slate-400">url: </span>{finding.injectionUrl}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Canary Reflected On</span>
                        <div className="bg-[#0f1a26] border border-slate-700 p-3 rounded-lg font-mono text-[12px] text-slate-300 break-all">
                          {finding.reflectedOnUrl}
                        </div>
                      </div>
                      {finding.surroundingHtml && (
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">HTML Context Snippet</span>
                          <div className="bg-[#0f1a26] border border-slate-700 p-3 rounded-lg font-mono text-[11px] text-slate-400 break-all whitespace-pre-wrap">
                            {finding.surroundingHtml.slice(0, 250)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* Detailed Tool-by-Tool Output Accordions */}
      {scanners && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            Individual Tool Outputs
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { id: 'katana', name: 'Katana Crawler', data: scanners.katana?.urls || [], count: scanners.katana?.count || 0, icon: Globe, color: 'text-cyan-400' },
              { id: 'gospider', name: 'GoSpider Crawler', data: scanners.gospider?.urls || [], count: scanners.gospider?.count || 0, icon: Search, color: 'text-blue-400' },
              { id: 'hakrawler', name: 'Hakrawler Endpoint Discovery', data: scanners.hakrawler?.urls || [], count: scanners.hakrawler?.count || 0, icon: Radar, color: 'text-indigo-400' },
              { id: 'arjun', name: 'Arjun Parameter Discovery', data: scanners.arjun?.params || [], count: scanners.arjun?.count || 0, icon: Cpu, color: 'text-violet-400' },
              { id: 'playwright', name: 'Playwright Browser Crawler', data: scanners.playwright?.urls || [], count: scanners.playwright?.count || 0, icon: Eye, color: 'text-purple-400' },
            ].map(tool => {
              const ToolIcon = tool.icon;
              return (
                <ToolAccordionItem
                  key={tool.id}
                  title={tool.name}
                  count={tool.count}
                  items={tool.data}
                  icon={ToolIcon}
                  color={tool.color}
                />
              );
            })}
          </div>
        </div>
      )}

      {unifiedResults && (
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            Unified Recon Summary
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-cyan-400">{unifiedResults.totalUniqueUrls}</span>
              <span className="text-xs text-slate-400 uppercase tracking-wider mt-1">Unique URLs</span>
            </div>
            <div className="glass-panel p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-cyan-400">{unifiedResults.totalUniqueParams}</span>
              <span className="text-xs text-slate-400 uppercase tracking-wider mt-1">Parameters</span>
            </div>
          </div>

          <div className="glass-panel p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-slate-400" />
              Discovered Parameters
            </h4>
            <div className="flex flex-wrap gap-2">
              {unifiedResults.params && unifiedResults.params.length > 0 ? (
                unifiedResults.params.map((p, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded">
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500 italic">No parameters found.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
