/**
 * XSS Static Pattern Analyzer
 * Scans HTML/JS source code for common XSS vulnerability patterns
 * BEFORE sending to LLM for deeper analysis.
 */

// Patterns that indicate user input reflected without encoding
const XSS_PATTERNS = [
  // Direct innerHTML / document.write usage
  { pattern: /\.innerHTML\s*=\s*/gi, label: 'innerHTML assignment (DOM XSS sink)' },
  { pattern: /document\.write\s*\(/gi, label: 'document.write() (DOM XSS sink)' },
  { pattern: /\.outerHTML\s*=\s*/gi, label: 'outerHTML assignment (DOM XSS sink)' },

  // Dangerous eval / Function constructor
  { pattern: /eval\s*\(/gi, label: 'eval() usage (code execution sink)' },
  { pattern: /new\s+Function\s*\(/gi, label: 'new Function() (code execution sink)' },
  { pattern: /setTimeout\s*\(\s*['"`]/gi, label: 'setTimeout with string (code execution)' },
  { pattern: /setInterval\s*\(\s*['"`]/gi, label: 'setInterval with string (code execution)' },

  // URL-based sources
  { pattern: /location\.hash/gi, label: 'location.hash read (URL fragment source)' },
  { pattern: /location\.search/gi, label: 'location.search read (query string source)' },
  { pattern: /location\.href/gi, label: 'location.href read (full URL source)' },
  { pattern: /document\.URL/gi, label: 'document.URL read (URL source)' },
  { pattern: /document\.referrer/gi, label: 'document.referrer read (referrer source)' },
  { pattern: /window\.name/gi, label: 'window.name read (cross-origin source)' },

  // URLSearchParams used to read user input
  { pattern: /URLSearchParams/gi, label: 'URLSearchParams (query param reader)' },
  { pattern: /\.searchParams\.get\s*\(/gi, label: 'searchParams.get() (param extraction)' },

  // jQuery dangerous sinks
  { pattern: /\$\(.*\)\.html\s*\(/gi, label: '$.html() (jQuery XSS sink)' },
  { pattern: /\$\(.*\)\.append\s*\(/gi, label: '$.append() (jQuery XSS sink)' },
  { pattern: /\$\(.*\)\.prepend\s*\(/gi, label: '$.prepend() (jQuery XSS sink)' },
  { pattern: /\$\(.*\)\.after\s*\(/gi, label: '$.after() (jQuery XSS sink)' },
  { pattern: /\$\(.*\)\.before\s*\(/gi, label: '$.before() (jQuery XSS sink)' },

  // Server-side reflected patterns in HTML
  { pattern: /value\s*=\s*["'][^"']*\{\{/gi, label: 'Template injection in value attribute' },
  { pattern: /<%=\s*.*%>/gi, label: 'EJS/ERB unescaped output (<%= %>)' },
  { pattern: /\{\{[^}]+\}\}/gi, label: 'Template variable ({{...}}) in HTML' },

  // Event handler injection points
  { pattern: /on(click|load|error|mouseover|focus|blur|submit|change|input)\s*=\s*["']/gi, label: 'Inline event handler (potential injection point)' },

  // Dangerous src/href attributes
  { pattern: /javascript\s*:/gi, label: 'javascript: protocol in attribute' },
  { pattern: /data\s*:\s*text\/html/gi, label: 'data:text/html protocol (XSS vector)' },

  // Forms without CSRF protection
  { pattern: /<form[^>]*method\s*=\s*["']post["'][^>]*>/gi, label: 'POST form detected' },
];

// Patterns indicating XSS protection IS present
const PROTECTION_PATTERNS = [
  { pattern: /content-security-policy/gi, label: 'CSP header reference found' },
  { pattern: /X-XSS-Protection/gi, label: 'X-XSS-Protection header reference' },
  { pattern: /DOMPurify/gi, label: 'DOMPurify sanitizer detected' },
  { pattern: /sanitize|escape|encode/gi, label: 'Sanitization/encoding function detected' },
  { pattern: /textContent\s*=/gi, label: 'Safe textContent assignment' },
  { pattern: /createTextNode/gi, label: 'Safe createTextNode usage' },
  { pattern: /csrf|_token|authenticity_token/gi, label: 'CSRF token pattern detected' },
];

/**
 * Analyze source code for XSS vulnerability patterns.
 * @param {string} sourceCode - Raw HTML/JS source
 * @param {string} url - The URL of the page
 * @returns {{ url, xssFindings: Array, protections: Array, riskLevel: string }}
 */
export const analyzeForXSS = (sourceCode, url) => {
  if (!sourceCode) return { url, xssFindings: [], protections: [], riskLevel: 'unknown' };

  const xssFindings = [];
  const protections = [];

  // Check for XSS vulnerability patterns
  for (const { pattern, label } of XSS_PATTERNS) {
    const matches = sourceCode.match(pattern);
    if (matches && matches.length > 0) {
      // Find line number of first match
      const idx = sourceCode.search(pattern);
      const lineNum = sourceCode.substring(0, idx).split('\n').length;
      const snippet = sourceCode.substring(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ').trim();

      xssFindings.push({
        pattern: label,
        occurrences: matches.length,
        firstLineApprox: lineNum,
        snippet: snippet.length > 80 ? snippet.slice(0, 80) + '...' : snippet
      });
    }
  }

  // Check for existing protections
  for (const { pattern, label } of PROTECTION_PATTERNS) {
    if (pattern.test(sourceCode)) {
      protections.push(label);
    }
  }

  // Calculate risk level
  let riskLevel = 'low';
  const dangerousSinks = xssFindings.filter(f =>
    f.pattern.includes('innerHTML') ||
    f.pattern.includes('document.write') ||
    f.pattern.includes('eval') ||
    f.pattern.includes('$.html') ||
    f.pattern.includes('javascript:')
  );

  if (dangerousSinks.length > 0 && protections.length === 0) {
    riskLevel = 'high';
  } else if (dangerousSinks.length > 0 && protections.length > 0) {
    riskLevel = 'medium';
  } else if (xssFindings.length > 0) {
    riskLevel = 'medium';
  }

  return { url, xssFindings, protections, riskLevel };
};
