'use client';

import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Code, FileCode, Search, Shield, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { formatSourceCode } from '../utils/codeFormatter';

/**
 * DevTools-Style Source Inspector Modal
 * Displays HTML & JS source code with line numbers, search, tab switching,
 * matching Chrome DevTools "Inspect Source" (view-source).
 * 
 * NEW: Semgrep Findings tab with line-based highlighting.
 */
export default function SourceInspectorModal({ isOpen, onClose, url, sourceCode, htmlSource, jsScripts, semgrepFindings }) {
  const [activeTab, setActiveTab] = useState('html'); // Default to 'html' for Elements Tab DOM Tree
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hasSemgrepFindings = semgrepFindings && semgrepFindings.length > 0;

  // Determine active raw text content (default to htmlSource for Elements Tab DOM)
  let rawCode = htmlSource || sourceCode || 'No DOM code captured.';
  if (activeTab === 'all') {
    rawCode = sourceCode || htmlSource || '';
  } else if (activeTab === 'html' && htmlSource) {
    rawCode = htmlSource;
  } else if (activeTab === 'semgrep') {
    rawCode = htmlSource || sourceCode || '';
  } else if (typeof activeTab === 'number' && jsScripts && jsScripts[activeTab]) {
    rawCode = jsScripts[activeTab].code;
  }

  // Automatically format single-line / minified code into clean indented multi-line code
  const displayCode = useMemo(() => formatSourceCode(rawCode), [rawCode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = displayCode.split('\n');

  // Build a set of line numbers that have Semgrep findings for highlighting
  const semgrepLineSet = useMemo(() => {
    if (!hasSemgrepFindings) return new Set();
    const lineNums = new Set();
    for (const f of semgrepFindings) {
      if (f.line) {
        for (let l = f.line; l <= (f.endLine || f.line); l++) {
          lineNums.add(l);
        }
      }
    }
    return lineNums;
  }, [semgrepFindings, hasSemgrepFindings]);

  // Syntax colorizer for Chrome DevTools Elements Tab look
  const renderFormattedLine = (lineText) => {
    if (!lineText) return ' ';

    // Highlight HTML tags: <tag, </tag>, attributes, strings
    if (lineText.includes('<') || lineText.includes('>')) {
      const parts = lineText.split(/(<[^>]+>)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith('<') && part.endsWith('>')) {
          const isClosing = part.startsWith('</');
          const isSelf = part.endsWith('/>');
          const content = part.slice(isClosing ? 2 : 1, isSelf ? -2 : -1).trim();
          const spaceIdx = content.indexOf(' ');
          const tagName = spaceIdx > -1 ? content.slice(0, spaceIdx) : content;
          const rest = spaceIdx > -1 ? content.slice(spaceIdx) : '';

          return (
            <span key={pIdx} className="text-[#881280] dark:text-[#f472b6] font-semibold">
              &lt;{isClosing ? '/' : ''}
              <span className="text-[#881280] dark:text-[#f472b6] font-bold">{tagName}</span>
              <span className="text-[#994500] dark:text-[#fb923c] font-normal">{rest}</span>
              {isSelf ? ' /' : ''}&gt;
            </span>
          );
        }
        return <span key={pIdx} className="text-slate-200">{part}</span>;
      });
    }

    return lineText;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      
      {/* Modal Container — DevTools Style */}
      <div className="w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* DevTools Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2 overflow-hidden text-slate-300">
            <div className="flex gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">DevTools Elements Tab (Rendered DOM):</span>
            <strong className="text-cyan-300 truncate max-w-md">{url}</strong>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2" />
              <input
                type="text"
                placeholder="Find in DOM..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-md pl-7 pr-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 w-40"
              />
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md transition-colors text-[11px]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DevTools File Tabs Bar */}
        <div className="flex items-center gap-1 px-3 py-1 bg-slate-950/60 border-b border-slate-800 text-[11px] font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-3 py-1 rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'html'
                ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>index.html (Elements DOM Tree)</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>All Combined</span>
          </button>

          {jsScripts && jsScripts.map((js, idx) => {
            const fileName = js.url.split('/').pop() || `script-${idx + 1}.js`;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                aria-selected={activeTab === idx}
                className={`px-3 py-1 rounded-t-md transition-colors flex items-center gap-1.5 ${
                  activeTab === idx
                    ? 'bg-slate-900 text-cyan-400 border-t-2 border-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{fileName}</span>
              </button>
            );
          })}

          {/* Semgrep Findings Tab (only appears when findings exist) */}
          {hasSemgrepFindings && (
            <button
              onClick={() => setActiveTab('semgrep')}
              className={`px-3 py-1 rounded-t-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'semgrep'
                  ? 'bg-slate-900 text-red-400 border-t-2 border-red-400 font-semibold'
                  : 'text-red-400/70 hover:text-red-300'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Semgrep Findings ({semgrepFindings.length})</span>
            </button>
          )}
        </div>

        {/* Semgrep Findings List View (when Semgrep tab is active) */}
        {activeTab === 'semgrep' && hasSemgrepFindings ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left: Findings list */}
            <div className="w-full lg:w-[380px] bg-slate-950 border-r border-slate-800 overflow-y-auto p-3 space-y-2">
              <div className="text-[11px] text-slate-400 font-mono mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>{semgrepFindings.length} XSS Finding{semgrepFindings.length !== 1 ? 's' : ''} Detected by Semgrep</span>
              </div>
              {semgrepFindings.map((finding, fIdx) => {
                const severityColors = {
                  ERROR: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300', badge: 'bg-red-500/25 text-red-300 border-red-500/40' },
                  WARNING: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300', badge: 'bg-amber-500/25 text-amber-300 border-amber-500/40' },
                  INFO: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-300', badge: 'bg-blue-500/25 text-blue-300 border-blue-500/40' },
                }[finding.severity] || { bg: 'bg-slate-500/15', border: 'border-slate-500/30', text: 'text-slate-300', badge: 'bg-slate-500/25 text-slate-300 border-slate-500/40' };

                return (
                  <div key={fIdx} className={`${severityColors.bg} border ${severityColors.border} rounded-lg p-2.5 text-xs`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${severityColors.badge}`}>
                        {finding.severity}
                      </span>
                      <span className={`font-mono text-[10px] ${severityColors.text} font-semibold truncate`}>
                        {finding.category || finding.ruleId}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mb-1">
                      Line {finding.line}{finding.endLine && finding.endLine !== finding.line ? `–${finding.endLine}` : ''}
                      {finding.metadata?.cwe?.length > 0 && (
                        <span className="text-purple-400 ml-2">{finding.metadata.cwe.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                    {finding.codeSnippet && (
                      <pre className="bg-slate-900/80 rounded p-1.5 text-[10px] font-mono text-red-300/80 overflow-x-auto mb-1 border border-slate-800/40">
                        {finding.codeSnippet.slice(0, 150)}
                      </pre>
                    )}
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {finding.message.slice(0, 200)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Right: Source code with highlighted lines */}
            <div className="flex-1 bg-slate-950 overflow-auto font-mono text-xs text-slate-200">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => {
                    const lineNum = idx + 1;
                    const matchesSearch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                    const isSemgrepLine = semgrepLineSet.has(lineNum);

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-900/60 ${
                          isSemgrepLine
                            ? 'bg-red-500/15 border-l-2 border-red-500'
                            : matchesSearch
                            ? 'bg-amber-500/20 text-amber-200 font-bold'
                            : ''
                        }`}
                      >
                        <td className={`w-12 text-right select-none pr-3 py-0.5 border-r border-slate-800/60 text-[11px] ${
                          isSemgrepLine ? 'text-red-400 font-bold' : 'text-slate-600'
                        }`}>
                          {isSemgrepLine && <AlertTriangle className="w-2.5 h-2.5 inline-block mr-0.5 text-red-400" />}
                          {lineNum}
                        </td>
                        <td className={`pl-4 py-0.5 whitespace-pre font-mono leading-relaxed ${
                          isSemgrepLine ? 'text-red-200' : 'text-slate-300'
                        }`}>
                          {renderFormattedLine(line)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Standard Code Viewer Box with Line Numbers */
          <div className="flex-1 bg-slate-950 overflow-auto font-mono text-xs text-slate-200">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => {
                  const lineNum = idx + 1;
                  const matchesSearch = searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
                  const isSemgrepLine = hasSemgrepFindings && semgrepLineSet.has(lineNum);

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-900/60 ${
                        isSemgrepLine
                          ? 'bg-red-500/10'
                          : matchesSearch
                          ? 'bg-amber-500/20 text-amber-200 font-bold'
                          : ''
                      }`}
                    >
                      {/* Line Number Column */}
                      <td className={`w-12 text-right select-none pr-3 py-0.5 border-r border-slate-800/60 text-[11px] ${
                        isSemgrepLine ? 'text-red-400' : 'text-slate-600'
                      }`}>
                        {lineNum}
                      </td>

                      {/* Code Content Line with DevTools Syntax Highlighting */}
                      <td className="pl-4 py-0.5 whitespace-pre font-mono text-slate-300 leading-relaxed">
                        {renderFormattedLine(line)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* DevTools Footer Bar */}
        <div className="px-4 py-1.5 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex justify-between items-center">
          <span>Total Lines: {lines.length}</span>
          <div className="flex items-center gap-3">
            {hasSemgrepFindings && (
              <span className="text-red-400 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                {semgrepFindings.length} Semgrep finding{semgrepFindings.length !== 1 ? 's' : ''}
              </span>
            )}
            <span>Encoding: UTF-8 | Format: DevTools Source View</span>
          </div>
        </div>

      </div>

    </div>
  );
}
