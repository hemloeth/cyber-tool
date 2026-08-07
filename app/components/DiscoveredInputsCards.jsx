'use client';

import React, { useState } from 'react';
import { Globe, Lock, Eye, EyeOff, Tag, FileText, Code, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, ChevronDown, ChevronUp, AlertTriangle, Info, Loader2 } from 'lucide-react';
import SourceInspectorModal from './SourceInspectorModal';

/**
 * Verdict badge color/icon mapping for Semgrep results
 */
const VERDICT_CONFIG = {
  vulnerable: {
    label: 'Vulnerable',
    icon: ShieldAlert,
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
    dotColor: 'bg-red-500'
  },
  suspicious: {
    label: 'Suspicious',
    icon: ShieldQuestion,
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotColor: 'bg-amber-500'
  },
  safe: {
    label: 'Safe',
    icon: ShieldCheck,
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    dotColor: 'bg-emerald-500'
  },
  unavailable: {
    label: 'Unavailable',
    icon: Shield,
    bgClass: 'bg-slate-500/15',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30',
    dotColor: 'bg-slate-500'
  },
  error: {
    label: 'Error',
    icon: AlertTriangle,
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    dotColor: 'bg-orange-500'
  }
};

/**
 * Severity badge for individual Semgrep findings
 */
const SeverityBadge = ({ severity }) => {
  const config = {
    ERROR: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40' },
    WARNING: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
    INFO: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
  }[severity] || { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/40' };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${config.bg} ${config.text} border ${config.border}`}>
      {severity}
    </span>
  );
};

export default function DiscoveredInputsCards({ data }) {
  const [activeModalCard, setActiveModalCard] = useState(null);
  // Per-card Semgrep scan state: { [cardIndex]: { loading, result } }
  const [semgrepScans, setSemgrepScans] = useState({});
  // Per-card findings panel expanded state
  const [expandedFindings, setExpandedFindings] = useState({});

  if (!data) return null;

  // Handles both array or object with discoveredInputs / pagesAnalyzed
  const target = data.target || data.targetUrl || '';
  const cards = data.discoveredInputs || data.pagesAnalyzed || data.endpointsWithInputs || [];

  if (!Array.isArray(cards) || cards.length === 0) return null;

  /**
   * Step 3: Run Semgrep XSS scan on the source code fetched in Step 2
   */
  const handleSemgrepScan = async (cardIndex, card) => {
    const targetUrl = card.url || card.pageUrl || card.endpoint;
    const sourceToScan = card.sourceCodeSnippet || card.sourceCode || card.htmlSource || '';

    if (!sourceToScan || sourceToScan.length < 10) {
      setSemgrepScans(prev => ({
        ...prev,
        [cardIndex]: {
          loading: false,
          result: {
            verdict: 'error',
            findingsCount: 0,
            findings: [],
            error: 'No source code available. Click "Step 2: Fetch Rendered DOM" first.'
          }
        }
      }));
      return;
    }

    // Set loading state
    setSemgrepScans(prev => ({
      ...prev,
      [cardIndex]: { loading: true, result: null }
    }));

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';
      const res = await fetch(`${API_BASE_URL}/crawler/semgrep-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: sourceToScan,
          fileType: 'html',
          url: targetUrl
        })
      });

      const data = await res.json();

      if (data.success) {
        setSemgrepScans(prev => ({
          ...prev,
          [cardIndex]: { loading: false, result: data }
        }));
        // Auto-expand findings if there are any
        if (data.findingsCount > 0) {
          setExpandedFindings(prev => ({ ...prev, [cardIndex]: true }));
        }
      } else {
        setSemgrepScans(prev => ({
          ...prev,
          [cardIndex]: {
            loading: false,
            result: {
              verdict: 'error',
              findingsCount: 0,
              findings: [],
              error: data.error || 'Semgrep scan failed'
            }
          }
        }));
      }
    } catch (err) {
      setSemgrepScans(prev => ({
        ...prev,
        [cardIndex]: {
          loading: false,
          result: {
            verdict: 'error',
            findingsCount: 0,
            findings: [],
            error: `Network error: ${err.message}`
          }
        }
      }));
    }
  };

  return (
    <div className="my-3 flex flex-col gap-3.5 font-sans">
      
      {/* Target Banner Header */}
      {target && (
        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Target Domain:</span>
            <strong className="text-cyan-300 font-semibold">{target}</strong>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-mono">
            {cards.length} Endpoints Discovered
          </span>
        </div>
      )}

      {/* Grid of Interactive UI Endpoint Cards */}
      <div className="grid grid-cols-1 gap-3">
        {cards.map((card, idx) => {
          const url = card.url || card.pageUrl || card.endpoint || '';
          const method = (card.method || 'GET').toUpperCase();
          const visibleInputs = card.inputs || card.visibleInputs || [];
          const hiddenInputs = card.hiddenInputs || [];
          const isPost = method === 'POST';
          const scanState = semgrepScans[idx] || (card.semgrepResult ? { loading: false, result: card.semgrepResult } : null);
          const isFindingsExpanded = expandedFindings[idx] !== undefined ? expandedFindings[idx] : (scanState?.result?.findingsCount > 0);
          const isDomFetched = !!(card.sourceCode || card.htmlSource || card.sourceCodeSnippet);

          return (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 transition-all shadow-sm"
            >
              {/* Card Title & Method Badge & Action Buttons */}
              <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-slate-800/60">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md ${
                    isPost
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {method}
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                    {url}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Step 2: Fetch Rendered DOM Playwright Button */}
                  <button
                    onClick={async () => {
                      const targetUrl = card.url || card.pageUrl || card.endpoint;
                      if (!targetUrl) return;

                      // If DOM was already auto-fetched by Step 2 orchestrator, open immediately
                      if (card.sourceCode || card.htmlSource || card.sourceCodeSnippet) {
                        const source = card.htmlSource || card.sourceCode || card.sourceCodeSnippet;
                        setActiveModalCard({
                          ...card,
                          url: targetUrl,
                          htmlSource: source,
                          sourceCode: source
                        });
                        return;
                      }

                      // Open modal immediately with loading state
                      setActiveModalCard({
                        ...card,
                        url: targetUrl,
                        htmlSource: 'Loading live Playwright DOM (networkidle)... Please wait...'
                      });

                      try {
                        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5001/api';
                        const res = await fetch(`${API_BASE_URL}/crawler/inspect-dom`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: targetUrl, method: card.method || 'GET', waitUntil: 'networkidle' })
                        });
                        const data = await res.json();

                        if (data.success && data.htmlContent) {
                          // Store fetched source code on the card object so Step 3 can use it
                          card.sourceCode = data.htmlContent;
                          card.htmlSource = data.htmlContent;

                          setActiveModalCard({
                            ...card,
                            url: targetUrl,
                            htmlSource: data.htmlContent,
                            sourceCode: data.htmlContent
                          });
                        } else {
                          setActiveModalCard({
                            ...card,
                            url: targetUrl,
                            htmlSource: `Failed to fetch DOM: ${data.error || 'Unknown error'}`
                          });
                        }
                      } catch (err) {
                        setActiveModalCard({
                          ...card,
                          url: targetUrl,
                          htmlSource: `Error fetching DOM: ${err.message}`
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all text-xs font-mono font-semibold shadow-sm hover:shadow-cyan-500/20"
                    title="Step 2: Launch Playwright to visit endpoint (networkidle) and extract raw Inspect Element DOM HTML"
                  >
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isDomFetched ? 'Step 2: DOM Auto-Extracted ✓' : 'Step 2: Fetch Rendered DOM'}</span>
                  </button>

                  {/* Step 3: Semgrep XSS Scan Button */}
                  <button
                    onClick={() => handleSemgrepScan(idx, card)}
                    disabled={scanState?.loading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-mono font-semibold shadow-sm ${
                      scanState?.loading
                        ? 'bg-amber-500/10 text-amber-400/60 border border-amber-500/20 cursor-wait'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 hover:shadow-amber-500/20'
                    }`}
                    title="Step 3: Run Semgrep static analysis with p/xss rules on the extracted source code"
                  >
                    {scanState?.loading ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{scanState?.loading ? 'Scanning...' : scanState?.result ? 'Step 3: Scanned ✓ (Re-scan)' : 'Step 3: Semgrep XSS Scan'}</span>
                  </button>

                  {card.classification && (
                    <span className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {card.classification}
                    </span>
                  )}
                </div>
              </div>

              {/* Semgrep Verdict Badge (appears after scan completes) */}
              {scanState?.result && (
                <div className="mb-2.5">
                  {(() => {
                    const verdict = scanState.result.verdict;
                    const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.error;
                    const VerdictIcon = config.icon;

                    return (
                      <div className={`flex items-center justify-between ${config.bgClass} border ${config.borderClass} rounded-lg px-3 py-2`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`} />
                          <VerdictIcon className={`w-4 h-4 ${config.textClass}`} />
                          <span className={`text-xs font-bold font-mono tracking-wide ${config.textClass}`}>
                            FINAL VERDICT: {config.label.toUpperCase()}
                          </span>
                          <span className="bg-slate-800/90 text-cyan-300 text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 font-mono font-normal flex items-center gap-1">
                            ⚡ Automated Steps 2 & 3
                          </span>
                          {scanState.result.findingsCount > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({scanState.result.findingsCount} finding{scanState.result.findingsCount !== 1 ? 's' : ''})
                            </span>
                          )}
                          {scanState.result.executionTimeMs && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              • {scanState.result.executionTimeMs}ms
                            </span>
                          )}
                        </div>

                        {/* Toggle findings panel */}
                        {scanState.result.findingsCount > 0 && (
                          <button
                            onClick={() => setExpandedFindings(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <span>{isFindingsExpanded ? 'Hide' : 'Show'} Findings</span>
                            {isFindingsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}

                        {/* Error message */}
                        {scanState.result.error && (
                          <span className="text-[10px] text-orange-400 font-mono truncate max-w-[300px]">
                            {scanState.result.error}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Expandable Findings Panel */}
                  {isFindingsExpanded && scanState.result.findings?.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {scanState.result.findings.map((finding, fIdx) => (
                        <div
                          key={fIdx}
                          className="bg-slate-950/80 border border-slate-800/60 rounded-lg p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <SeverityBadge severity={finding.severity} />
                            <span className="font-mono text-[11px] text-slate-300 font-semibold truncate">
                              {finding.category || finding.ruleId}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Line {finding.line}
                            </span>
                            {finding.metadata?.cwe?.length > 0 && (
                              <span className="text-[10px] text-purple-400 font-mono">
                                {finding.metadata.cwe.slice(0, 2).join(', ')}
                              </span>
                            )}
                          </div>

                          {/* Code snippet */}
                          {finding.codeSnippet && (
                            <pre className="bg-slate-900/80 rounded p-2 text-[11px] font-mono text-red-300/90 overflow-x-auto mb-1.5 border border-slate-800/40">
                              {finding.codeSnippet.slice(0, 200)}
                            </pre>
                          )}

                          {/* Finding message */}
                          <p className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
                            <Info className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                            {finding.message.slice(0, 300)}
                          </p>

                          {/* References */}
                          {finding.metadata?.references?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {finding.metadata.references.map((ref, rIdx) => (
                                <a
                                  key={rIdx}
                                  href={ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-cyan-500 hover:text-cyan-300 font-mono underline"
                                >
                                  ref-{rIdx + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Two Column Input Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Visible Inputs Column */}
                <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/40">
                  <div className="flex items-center gap-1.5 mb-2 text-emerald-400 font-medium text-[11px]">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visible Input Fields ({visibleInputs.length})</span>
                  </div>
                  {visibleInputs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleInputs.map((input, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-200 border border-slate-700/60 font-mono text-[11px] flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <strong className="text-cyan-300">{typeof input === 'string' ? input : input.name}</strong>
                          {input.type && <span className="text-slate-400 text-[10px]">({input.type})</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px] italic">No visible inputs</span>
                  )}
                </div>

                {/* Hidden Inputs Column */}
                <div className="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/40">
                  <div className="flex items-center gap-1.5 mb-2 text-purple-400 font-medium text-[11px]">
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hidden Input Fields ({hiddenInputs.length})</span>
                  </div>
                  {hiddenInputs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {hiddenInputs.map((hInput, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-purple-950/40 text-purple-200 border border-purple-800/40 font-mono text-[11px] flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3 text-purple-400" />
                          <strong className="text-purple-300">{hInput.name}</strong>
                          {hInput.value && <span className="text-purple-400/80 text-[10px] truncate max-w-[120px]">= "{hInput.value}"</span>}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[11px] italic">No hidden inputs</span>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>


      {/* DevTools Source Inspector Modal */}
      {activeModalCard && (
        <SourceInspectorModal
          isOpen={!!activeModalCard}
          onClose={() => setActiveModalCard(null)}
          url={activeModalCard.url || activeModalCard.endpoint}
          sourceCode={activeModalCard.sourceCodeSnippet || activeModalCard.sourceCode}
          htmlSource={activeModalCard.htmlSource}
          jsScripts={activeModalCard.jsScripts}
          semgrepFindings={semgrepScans[cards.findIndex(c => (c.url || c.pageUrl || c.endpoint) === (activeModalCard.url || activeModalCard.endpoint))]?.result?.findings}
        />
      )}

    </div>
  );
}
