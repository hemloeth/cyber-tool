/**
 * Semgrep XSS Static Analysis Service
 * 
 * Wraps the Semgrep CLI to run AST-aware XSS vulnerability detection
 * on extracted source code (HTML/JS) from the crawler pipeline.
 * 
 * Flow:
 *   1. Receives raw source code (from Step 2: Playwright DOM fetch)
 *   2. Extracts inline JavaScript from HTML <script> tags
 *   3. Writes JS code to a temp .js file (Semgrep XSS rules target JS)
 *   4. Spawns `semgrep` with both p/xss + custom rules
 *   5. Parses JSON output → structured findings
 *   6. Cleans up temp files
 *   7. Returns verdict + findings
 */

import { execFile } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Temp directory for Semgrep scan files (inside backend/)
const TEMP_DIR = join(__dirname, '..', '.semgrep-tmp');
// Custom XSS rules file
const CUSTOM_RULES_PATH = join(__dirname, '..', 'config', 'semgrep-xss-rules.yml');

/**
 * Ensure temp directory exists
 */
const ensureTempDir = async () => {
  try {
    await mkdir(TEMP_DIR, { recursive: true });
  } catch { }
};

/**
 * Extract inline JavaScript from HTML source code.
 * Pulls code from <script> tags and combines it for Semgrep analysis.
 * @param {string} html - Raw HTML source
 * @returns {string} Combined JavaScript code from all <script> blocks
 */
const extractJSFromHTML = (html) => {
  if (!html) return '';

  const scripts = [];
  // Match <script> blocks (with or without attributes)
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptContent = match[1].trim();
    if (scriptContent.length > 5) {
      scripts.push(`// === Inline Script Block ===\n${scriptContent}`);
    }
  }

  // Also extract inline event handlers as JS expressions
  const eventHandlerRegex = /\bon(?:click|load|error|mouseover|focus|blur|submit|change|input|keyup|keydown)\s*=\s*["']([^"']+)["']/gi;
  const handlers = [];
  while ((match = eventHandlerRegex.exec(html)) !== null) {
    handlers.push(match[1]);
  }
  if (handlers.length > 0) {
    scripts.push(`// === Inline Event Handlers ===\n${handlers.join(';\n')}`);
  }

  return scripts.join('\n\n');
};

/**
 * Check if Semgrep CLI is available on the system
 * @returns {Promise<{ available: boolean, version?: string, error?: string }>}
 */
export const checkSemgrepInstalled = () => {
  return new Promise((resolve) => {
    execFile('semgrep', ['--version'], { timeout: 10000 }, (error, stdout) => {
      if (error) {
        resolve({ available: false, error: error.message });
      } else {
        resolve({ available: true, version: stdout.trim() });
      }
    });
  });
};

/**
 * Run Semgrep XSS analysis on source code
 * 
 * @param {string} sourceCode - Raw HTML or JS source code to scan
 * @param {string} fileType - 'html' or 'js' (HTML will have JS extracted first)
 * @param {string} [url] - Optional URL for context in the results
 * @returns {Promise<{
 *   verdict: 'vulnerable' | 'suspicious' | 'safe' | 'unavailable' | 'error',
 *   findingsCount: number,
 *   findings: Array<{ ruleId: string, severity: string, message: string, line: number, col: number, codeSnippet: string }>,
 *   executionTimeMs: number,
 *   engineUsed: string,
 *   url?: string,
 *   error?: string
 * }>}
 */
export const runSemgrepXSS = async (sourceCode, fileType = 'html', url = '') => {
  const startTime = Date.now();

  if (!sourceCode || sourceCode.trim().length === 0) {
    return {
      verdict: 'error',
      findingsCount: 0,
      findings: [],
      executionTimeMs: Date.now() - startTime,
      engineUsed: 'semgrep',
      url,
      error: 'No source code provided'
    };
  }

  await ensureTempDir();

  // For HTML input: extract inline JS for Semgrep to analyze (Semgrep XSS rules target .js files)
  // Also scan the raw HTML as .html for any custom HTML-aware rules
  let jsCode = sourceCode;
  if (fileType === 'html') {
    const extractedJS = extractJSFromHTML(sourceCode);
    // Combine: raw source (for generic patterns) + extracted JS
    jsCode = extractedJS || sourceCode;
  }

  const scanId = randomUUID();
  const tempFiles = [];
  const allFindings = [];

  try {
    // Create .js temp file for JavaScript-focused scanning
    const jsFilePath = join(TEMP_DIR, `scan-${scanId}.js`);
    await writeFile(jsFilePath, jsCode, 'utf-8');
    tempFiles.push(jsFilePath);

    // Also create .html temp file if the input is HTML (for HTML-specific patterns)
    if (fileType === 'html') {
      const htmlFilePath = join(TEMP_DIR, `scan-${scanId}.html`);
      await writeFile(htmlFilePath, sourceCode, 'utf-8');
      tempFiles.push(htmlFilePath);
    }

    // Run Semgrep CLI against both files
    for (const filePath of tempFiles) {
      const semgrepResult = await runSemgrepCLI(filePath);
      const findings = parseSemgrepOutput(semgrepResult);
      allFindings.push(...findings);
    }

    // Deduplicate findings by ruleId + line
    const seen = new Set();
    const dedupedFindings = allFindings.filter(f => {
      const key = `${f.ruleId}:${f.line}:${f.codeSnippet.slice(0, 50)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate verdict based on findings
    const verdict = calculateVerdict(dedupedFindings);

    return {
      verdict,
      findingsCount: dedupedFindings.length,
      findings: dedupedFindings,
      executionTimeMs: Date.now() - startTime,
      engineUsed: 'semgrep',
      url
    };

  } catch (error) {
    // Check if Semgrep is not installed
    if (error.message.includes('ENOENT') || error.message.includes('not found') || error.message.includes('not recognized')) {
      return {
        verdict: 'unavailable',
        findingsCount: 0,
        findings: [],
        executionTimeMs: Date.now() - startTime,
        engineUsed: 'semgrep',
        url,
        error: 'Semgrep CLI is not installed. Run: pip install semgrep'
      };
    }

    return {
      verdict: 'error',
      findingsCount: 0,
      findings: [],
      executionTimeMs: Date.now() - startTime,
      engineUsed: 'semgrep',
      url,
      error: `Semgrep execution failed: ${error.message}`
    };

  } finally {
    // Always clean up temp files
    for (const f of tempFiles) {
      try { await unlink(f); } catch { }
    }
  }
};

/**
 * Spawn the Semgrep CLI process and return raw JSON output.
 * Uses both the official p/xss + p/default rulesets AND our custom XSS rules.
 * @param {string} filePath - Path to the temp file to scan
 * @returns {Promise<string>} Raw JSON output from Semgrep
 */
const runSemgrepCLI = (filePath) => {
  return new Promise((resolve, reject) => {
    const args = [
      '--config', 'p/xss',
      '--config', 'p/default',
      '--config', CUSTOM_RULES_PATH,
      '--json',
      '--no-git-ignore',
      '--timeout', '30',
      '--max-target-bytes', '1000000',
      filePath
    ];

    execFile('semgrep', args, {
      timeout: 60000,       // 60 second timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      env: { ...process.env }
    }, (error, stdout, stderr) => {
      // Semgrep exits with code 1 when it finds issues, but still outputs valid JSON
      if (error && !stdout) {
        reject(new Error(error.message || stderr || 'Semgrep process failed'));
        return;
      }

      resolve(stdout || '{}');
    });
  });
};

/**
 * Parse Semgrep JSON output into structured findings
 * @param {string} rawJson - Raw JSON string from Semgrep CLI
 * @returns {Array<{ ruleId: string, severity: string, message: string, line: number, col: number, endLine: number, endCol: number, codeSnippet: string, category: string }>}
 */
const parseSemgrepOutput = (rawJson) => {
  try {
    const output = JSON.parse(rawJson);
    const results = output.results || [];

    return results.map(result => ({
      ruleId: result.check_id || 'unknown',
      severity: (result.extra?.severity || 'WARNING').toUpperCase(),
      message: result.extra?.message || 'XSS vulnerability detected',
      line: result.start?.line || 0,
      col: result.start?.col || 0,
      endLine: result.end?.line || 0,
      endCol: result.end?.col || 0,
      codeSnippet: result.extra?.lines || '',
      category: extractCategory(result.check_id || ''),
      metadata: {
        confidence: result.extra?.metadata?.confidence || 'MEDIUM',
        impact: result.extra?.metadata?.impact || 'MEDIUM',
        cwe: result.extra?.metadata?.cwe || [],
        owaspCategory: result.extra?.metadata?.owasp || [],
        references: (result.extra?.metadata?.references || []).slice(0, 3)
      }
    }));

  } catch (error) {
    console.warn('[SemgrepService] Failed to parse Semgrep output:', error.message);
    return [];
  }
};

/**
 * Extract a human-readable category from the Semgrep rule ID
 * e.g., "javascript.browser.security.dom-based-xss.dom-based-xss" → "DOM-Based XSS"
 */
const extractCategory = (ruleId) => {
  if (ruleId.includes('dom-based-xss') || ruleId.includes('dom-xss')) return 'DOM-Based XSS';
  if (ruleId.includes('reflected-xss') || ruleId.includes('reflected')) return 'Reflected XSS';
  if (ruleId.includes('stored-xss') || ruleId.includes('stored')) return 'Stored XSS';
  if (ruleId.includes('innerHTML')) return 'innerHTML Injection';
  if (ruleId.includes('outerHTML')) return 'outerHTML Injection';
  if (ruleId.includes('document-write')) return 'document.write Injection';
  if (ruleId.includes('eval')) return 'Code Injection (eval)';
  if (ruleId.includes('new-function')) return 'Code Injection (Function)';
  if (ruleId.includes('setTimeout') || ruleId.includes('setInterval')) return 'Timer Code Injection';
  if (ruleId.includes('jquery-html')) return 'jQuery .html() XSS';
  if (ruleId.includes('jquery-append')) return 'jQuery .append() XSS';
  if (ruleId.includes('location-hash')) return 'XSS Source (location.hash)';
  if (ruleId.includes('location-search')) return 'XSS Source (location.search)';
  if (ruleId.includes('searchparams')) return 'XSS Source (URLSearchParams)';
  if (ruleId.includes('javascript-protocol')) return 'javascript: Protocol XSS';
  if (ruleId.includes('insertAdjacentHTML')) return 'insertAdjacentHTML Injection';
  if (ruleId.includes('src-assignment')) return 'Dynamic src Assignment';
  if (ruleId.includes('script-injection')) return 'Script Injection';
  return 'XSS Vulnerability';
};

/**
 * Calculate overall verdict from findings
 * @param {Array} findings - Parsed Semgrep findings
 * @returns {'vulnerable' | 'suspicious' | 'safe'}
 */
const calculateVerdict = (findings) => {
  if (findings.length === 0) return 'safe';

  const hasError = findings.some(f => f.severity === 'ERROR');
  const hasWarning = findings.some(f => f.severity === 'WARNING');

  if (hasError) return 'vulnerable';
  if (hasWarning) return 'suspicious';
  return 'suspicious';
};

/**
 * Format Semgrep findings for LLM context injection
 * @param {{ verdict, findings, url }} semgrepResult 
 * @returns {string} Formatted text for system prompt
 */
export const formatSemgrepForLLM = (semgrepResult) => {
  if (!semgrepResult || semgrepResult.findingsCount === 0) return '';

  const header = `[${semgrepResult.verdict.toUpperCase()}] Semgrep XSS Analysis — ${semgrepResult.url || 'unknown URL'}`;
  const findingsText = semgrepResult.findings
    .map(f => {
      const cwe = f.metadata?.cwe?.length > 0 ? ` (CWE: ${f.metadata.cwe.join(', ')})` : '';
      return `  • [${f.severity}] ${f.ruleId}${cwe}\n    Line ${f.line}: ${f.codeSnippet.slice(0, 120)}\n    → ${f.message.slice(0, 200)}`;
    })
    .join('\n');

  return `${header}\n${findingsText}`;
};
