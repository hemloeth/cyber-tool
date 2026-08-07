/**
 * Passive Endpoint Discovery via Wayback Machine CDX API.
 * Replaces ParamSpider — finds historical parameterized URLs for a domain
 * using archive.org's public CDX index. No requests are sent to the target.
 */

const WAYBACK_CDX_URL = 'https://web.archive.org/cdx/search/cdx';

// File extensions to exclude (static assets, not interesting for security)
const EXCLUDED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.css', '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.mp3', '.avi', '.mov', '.webm', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.map', '.min.js', '.min.css'
];

/**
 * Queries the Wayback Machine CDX API for historical URLs containing query parameters.
 * @param {string} domain - Target domain (e.g. "gtisec.com")
 * @param {number} limit - Max results to fetch
 * @returns {Promise<string[]>} Array of unique parameterized URLs
 */
export const discoverWaybackEndpoints = async (domain, limit = 500) => {
  console.log(`[WaybackRecon] Querying Wayback Machine for ${domain}...`);

  try {
    const params = new URLSearchParams({
      url: `${domain}/*`,
      output: 'text',
      fl: 'original',
      collapse: 'urlkey',
      limit: String(limit),
      filter: 'statuscode:200'
    });

    const res = await fetch(`${WAYBACK_CDX_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      console.warn(`[WaybackRecon] CDX API returned ${res.status}`);
      return [];
    }

    const rawText = await res.text();
    const allUrls = rawText.trim().split('\n').filter(Boolean);

    // Filter: Only keep URLs with query parameters (?key=value)
    const paramUrls = allUrls.filter(url => {
      try {
        const parsed = new URL(url);
        // Must have query parameters
        if (parsed.searchParams.toString() === '') return false;
        // Exclude static asset extensions
        const path = parsed.pathname.toLowerCase();
        return !EXCLUDED_EXTENSIONS.some(ext => path.endsWith(ext));
      } catch {
        return false;
      }
    });

    // Deduplicate by URL path + param names (ignore param values)
    const seen = new Set();
    const unique = [];
    for (const url of paramUrls) {
      try {
        const parsed = new URL(url);
        const paramNames = Array.from(parsed.searchParams.keys()).sort().join(',');
        const key = `${parsed.pathname}?${paramNames}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(url);
        }
      } catch {
        continue;
      }
    }

    console.log(`[WaybackRecon] Found ${unique.length} unique parameterized endpoints for ${domain}`);
    return unique;

  } catch (error) {
    console.error('[WaybackRecon] Error querying Wayback Machine:', error.message);
    return [];
  }
};
