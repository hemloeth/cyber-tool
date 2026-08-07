import { normalizeUrl } from './crawler.utils.js';

/**
 * Analyzes JavaScript code for API endpoints (fetch, axios, XHR, $.ajax).
 */
export const analyzeJavaScript = (jsCode, pageUrl) => {
  const discoveredEndpoints = new Set();
  if (!jsCode || typeof jsCode !== 'string') return [];

  // Patterns for fetch, axios, XHR, and API route literals
  const patterns = [
    /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /axios\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\$\s*\.\s*ajax\s*\(\s*\{\s*url\s*:\s*['"`]([^'"`]+)['"`]/g,
    /\.open\s*\(\s*['"`](?:GET|POST|PUT|DELETE)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
    /['"`](\/api\/[a-zA-Z0-9_\-\/]+)['"`]/g,
    /['"`](\/v[0-9]+\/[a-zA-Z0-9_\-\/]+)['"`]/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(jsCode)) !== null) {
      const routeStr = match[1];
      if (routeStr && !routeStr.startsWith('data:') && !routeStr.startsWith('javascript:')) {
        const fullUrl = normalizeUrl(routeStr, pageUrl);
        if (fullUrl) {
          discoveredEndpoints.add(fullUrl);
        }
      }
    }
  }

  return Array.from(discoveredEndpoints).map(url => ({
    type: 'javascript',
    endpoint: url,
    method: 'GET'
  }));
};
