import { chromium } from 'playwright';

/**
 * Visits a single endpoint URL using Playwright, waits for network idle state,
 * and extracts the full rendered DOM content ("Inspect Element" raw HTML).
 *
 * Equivalent Playwright logic:
 *   browser = playwright.chromium.launch()
 *   page = browser.new_page()
 *   page.goto(url, wait_until="networkidle")
 *   print(page.content())
 *
 * @param {string} url - The target endpoint URL
 * @param {object} options - Timeout & context settings
 * @returns {Promise<{url: string, htmlContent: string, status: number, error?: string}>}
 */
export const inspectEndpointDOM = async (url, options = {}) => {
  const { timeout = 30000, waitUntil = 'networkidle' } = options;

  let browser = null;

  try {
    // 1. Try launching default Playwright Chromium
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (launchErr) {
      console.warn('[PlaywrightVisitor] Default Chromium binary not found, attempting system Chrome channel:', launchErr.message);
      try {
        browser = await chromium.launch({
          channel: 'chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (chromeErr) {
        console.warn('[PlaywrightVisitor] System Chrome not found, attempting Edge channel:', chromeErr.message);
        browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberAIBrain/1.0'
    });

    const page = await context.newPage();

    console.log(`[PlaywrightVisitor] Navigating to ${url} (waitUntil: ${waitUntil})...`);

    const response = await page.goto(url, {
      waitUntil,
      timeout
    });

    // Extract the complete live-rendered HTML DOM state
    const htmlContent = await page.content();
    const httpStatus = response ? response.status() : 200;

    await browser.close();

    return {
      url,
      status: httpStatus,
      htmlContent,
      contentLength: htmlContent.length
    };
  } catch (error) {
    console.error(`[PlaywrightVisitor] Playwright error for ${url}:`, error.message);

    if (browser) {
      await browser.close().catch(() => {});
    }

    // Fallback: Perform HTTP fetch to return HTML if Playwright fails
    try {
      console.log(`[PlaywrightVisitor] Running HTTP fetch fallback for ${url}...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberAIBrain/1.0' },
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const text = await res.text();
        return {
          url,
          status: res.status,
          htmlContent: text,
          contentLength: text.length
        };
      }
    } catch (fetchErr) {
      console.error(`[PlaywrightVisitor] HTTP fetch fallback failed for ${url}:`, fetchErr.message);
    }

    return {
      url,
      status: 0,
      htmlContent: '',
      error: error.message
    };
  }
};


/**
 * Batch visits multiple endpoints using Playwright networkidle DOM extraction.
 *
 * @param {Array<string>} urls - List of endpoint URLs to inspect
 * @param {object} options - Execution options
 * @returns {Promise<Array<{url: string, htmlContent: string, status: number}>>}
 */
export const inspectEndpointsDOMBatch = async (urls, options = {}) => {
  const { timeout = 30000, waitUntil = 'networkidle' } = options;
  const results = [];

  if (!urls || urls.length === 0) return results;

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberAIBrain/1.0'
    });

    for (let i = 0; i < urls.length; i++) {
      const targetUrl = urls[i];
      console.log(`[PlaywrightVisitor] Inspecting DOM (${i + 1}/${urls.length}): ${targetUrl}`);

      const page = await context.newPage();
      try {
        const response = await page.goto(targetUrl, { waitUntil, timeout });
        const htmlContent = await page.content();
        const status = response ? response.status() : 200;

        results.push({
          url: targetUrl,
          status,
          htmlContent,
          contentLength: htmlContent.length
        });
      } catch (err) {
        console.warn(`[PlaywrightVisitor] Failed to render DOM for ${targetUrl}:`, err.message);
        results.push({
          url: targetUrl,
          status: 0,
          htmlContent: '',
          error: err.message
        });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } catch (err) {
    console.error('[PlaywrightVisitor] Fatal batch launch error:', err.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  return results;
};

/**
 * Smart wrapper around inspectEndpointDOM that automatically falls back to fetching
 * the parent page if a POST form-action endpoint (e.g. /Xss/Add) returns an empty body.
 */
export const inspectEndpointWithFallback = async (url, method = 'GET', options = {}) => {
  let result = await inspectEndpointDOM(url, options);

  // If the page body is empty/minimal (common with POST-only endpoints like /Xss/Add),
  // try the parent URL that likely contains the form
  const isEmptyBody = !result.htmlContent || 
    result.htmlContent.replace(/\s/g, '').length < 100 ||
    (/<body[^>]*>\s*<\/body>/i.test(result.htmlContent));

  if (isEmptyBody && (method === 'POST' || url.includes('/Add') || url.includes('/submit') || url.includes('/create'))) {
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      
      if (pathSegments.length > 1) {
        pathSegments.pop();
        parsedUrl.pathname = '/' + pathSegments.join('/');
        const parentUrl = parsedUrl.href;
        
        console.log(`[PlaywrightVisitor] POST endpoint ${url} returned empty body. Falling back to parent page: ${parentUrl}`);
        const parentResult = await inspectEndpointDOM(parentUrl, options);
        
        if (parentResult.htmlContent && parentResult.htmlContent.replace(/\s/g, '').length > 100) {
          result = parentResult;
          result.note = `POST endpoint ${url} returned empty body. Showing parent page: ${parentUrl}`;
        }
      }
    } catch (parentErr) {
      console.warn('[PlaywrightVisitor] Parent URL fallback failed:', parentErr.message);
    }
  }

  return result;
};
