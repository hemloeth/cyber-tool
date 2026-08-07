import * as cheerio from 'cheerio';

/**
 * Enhanced Source Code Visitor — fetches live page HTML AND external JavaScript files
 * referenced in <script src="..."> tags so full JS logic is available for analysis.
 */

const MAX_HTML_LENGTH = 10000;
const MAX_JS_LENGTH = 8000;

/**
 * Visits a live URL, fetches HTML + linked JS source code.
 * @param {string} url - Target endpoint URL
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<{url: string, sourceCode: string, htmlSource: string, jsScripts: Array, sourceLength: number} | {url: string, error: string}>}
 */


export const visitAndReadSource = async (url, timeoutMs = 15000) => {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberAIBrain/1.0'
      }
    });

    if (!res.ok) {
      return { url, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
      return { url, error: `Non-HTML content type: ${contentType}` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract inline scripts
    const inlineScripts = [];
    $('script').each((_, el) => {
      const inlineCode = $(el).html();
      if (inlineCode && inlineCode.trim().length > 10) {
        inlineScripts.push(inlineCode.trim());
      }
    });

    // Extract external script URLs (<script src="...">)
    const scriptSrcs = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          const absoluteUrl = new URL(src, url).href;
          // Filter out analytics / third-party trackers
          if (!src.includes('google-analytics') && !src.includes('gtag') && !src.includes('facebook') && !src.includes('doubleclick')) {
            scriptSrcs.push(absoluteUrl);
          }
        } catch { }
      }
    });

    // Fetch up to 3 external JS files
    const jsContents = [];
    const jsTargets = scriptSrcs.slice(0, 3);

    for (const jsUrl of jsTargets) {
      try {
        const jsRes = await fetch(jsUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberAIBrain/1.0' }
        });
        if (jsRes.ok) {
          const jsText = await jsRes.text();
          jsContents.push({ url: jsUrl, code: jsText.slice(0, MAX_JS_LENGTH) });
        }
      } catch { }
    }

    // Combine HTML + Inline JS + External JS into complete sourceCode
    let combinedSource = `=== HTML SOURCE (${url}) ===\n${html.slice(0, MAX_HTML_LENGTH)}\n`;

    if (inlineScripts.length > 0) {
      combinedSource += `\n=== INLINE JAVASCRIPT (${inlineScripts.length} blocks) ===\n` +
        inlineScripts.slice(0, 5).join('\n--- INLINE SCRIPT ---\n').slice(0, MAX_JS_LENGTH) + '\n';
    }

    if (jsContents.length > 0) {
      combinedSource += `\n=== EXTERNAL JAVASCRIPT FILES (${jsContents.length} files) ===\n` +
        jsContents.map(j => `// [Script: ${j.url}]\n${j.code}`).join('\n\n');
    }

    return {
      url,
      htmlSource: html.slice(0, MAX_HTML_LENGTH),
      jsScripts: jsContents,
      sourceCode: combinedSource,
      sourceLength: combinedSource.length
    };

  } catch (error) {
    return { url, error: `Fetch failed: ${error.message}` };
  }
};

/**
 * Visits multiple URLs with a politeness delay.
 */
export const visitEndpoints = async (urls, delayMs = 1000) => {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    console.log(`[SourceVisitor] Visiting (${i + 1}/${urls.length}): ${urls[i]}`);
    const result = await visitAndReadSource(urls[i]);
    results.push(result);

    if (i < urls.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
};
