import { chromium } from 'playwright';
import { validateTargetUrl, isSameDomain, normalizeUrl } from './crawler.utils.js';
import { discoverUrls } from './urlDiscovery.js';
import { extractForms } from './formExtractor.js';
import { extractParameters } from './parameterExtractor.js';
import { analyzeJavaScript } from './jsAnalyzer.js';
import { Scan } from '../models/Scan.js';
import { Endpoint } from '../models/Endpoint.js';
import { Form } from '../models/Form.js';

/**
 * Orchestrates Playwright browser crawling for website endpoint and form discovery.
 */
export const crawlWebsite = async (targetUrl, options = {}) => {
  const { maxDepth = 3, maxUrls = 50, timeout = 30000 } = options;

  // 1. Validate Target URL & Check SSRF Protections
  const validation = validateTargetUrl(targetUrl);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const rootUrl = validation.normalizedUrl;

  // 2. Initialize Scan DB Record
  const scan = await Scan.create({
    targetUrl: rootUrl,
    status: 'running',
    createdAt: new Date()
  });

  const visitedUrls = new Set();
  const queue = [{ url: rootUrl, depth: 0 }];
  const discoveredEndpoints = new Map(); // Key: url+method
  const discoveredForms = [];
  const discoveredJSRoutes = [];

  let browser = null;

  try {
    // Launch Playwright Headless Browser
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (e) {
      console.warn('[Crawler] Playwright Chromium launch error, running HTTP fallback:', e.message);
    }

    const context = browser ? await browser.newContext() : null;

    while (queue.length > 0 && visitedUrls.size < maxUrls) {
      const { url: currentUrl, depth } = queue.shift();

      if (visitedUrls.has(currentUrl) || depth > maxDepth) {
        continue;
      }

      visitedUrls.add(currentUrl);
      console.log(`[Crawler] Visiting (${visitedUrls.size}/${maxUrls}): ${currentUrl} (depth ${depth})`);

      let htmlContent = '';
      let inlineScripts = [];

      if (context) {
        const page = await context.newPage();
        try {
          // Intercept XHR / Fetch network requests made by Playwright browser
          page.on('request', req => {
            const reqUrl = req.url();
            if (isSameDomain(reqUrl, rootUrl)) {
              const method = req.method();
              const key = `${reqUrl}_${method}`;
              if (!discoveredEndpoints.has(key)) {
                discoveredEndpoints.set(key, {
                  url: reqUrl,
                  method,
                  parameters: extractParameters(reqUrl),
                  source: 'javascript'
                });
              }
            }
          });

          await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout });
          htmlContent = await page.content();

          // Extract inline script contents
          inlineScripts = await page.$$eval('script', scripts =>
            scripts.map(s => s.textContent).filter(Boolean)
          );

          // Dynamic DOM Inspection: Extract computed hidden inputs (CSS hidden, offscreen, type=hidden)
          const domHiddenFields = await page.$$eval('input, textarea, select', elements =>
            elements.filter(el => {
              const style = window.getComputedStyle(el);
              const isHiddenType = el.type === 'hidden';
              const isCSSHidden = style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
              const isOffscreen = el.getBoundingClientRect().width === 0 || el.getBoundingClientRect().height === 0;
              return isHiddenType || isCSSHidden || isOffscreen;
            }).map(el => ({
              name: el.name || el.id,
              type: el.type === 'hidden' ? 'hidden' : `hidden (${el.type})`,
              value: el.value || '',
              isHidden: true
            })).filter(item => item.name && item.name.trim() !== '')
          );

          if (domHiddenFields.length > 0) {
            discoveredForms.push({
              scanId: scan._id,
              endpoint: currentUrl,
              method: 'POST',
              inputs: domHiddenFields
            });
          }

        } catch (err) {
          console.warn(`[Crawler] Warning visiting ${currentUrl}:`, err.message);
        } finally {
          await page.close();
        }
      } else {
        // Fallback HTTP Fetch if Playwright is unavailable
        try {
          const res = await fetch(currentUrl, { signal: AbortSignal.timeout(timeout) });
          htmlContent = await res.text();
        } catch (err) {
          console.warn(`[Crawler] HTTP Fetch failed for ${currentUrl}:`, err.message);
        }
      }

      if (!htmlContent) continue;

      // A. Extract GET Parameters from Current URL
      const urlParams = extractParameters(currentUrl);
      const urlKey = `${currentUrl}_GET`;
      if (!discoveredEndpoints.has(urlKey)) {
        discoveredEndpoints.set(urlKey, {
          url: currentUrl,
          method: 'GET',
          parameters: urlParams,
          source: 'html'
        });
      }

      // B. Extract Forms via Cheerio
      const forms = extractForms(htmlContent, currentUrl);
      for (const form of forms) {
        discoveredForms.push({
          scanId: scan._id,
          endpoint: form.endpoint,
          method: form.method,
          inputs: form.inputs
        });

        // Also add form action as discovered endpoint
        const formKey = `${form.endpoint}_${form.method}`;
        if (!discoveredEndpoints.has(formKey)) {
          discoveredEndpoints.set(formKey, {
            url: form.endpoint,
            method: form.method,
            parameters: form.inputs.map(i => i.name),
            source: 'form'
          });
        }
      }

      // C. Extract JS Endpoints via JS Analyzer
      for (const scriptCode of inlineScripts) {
        const jsRoutes = analyzeJavaScript(scriptCode, currentUrl);
        for (const route of jsRoutes) {
          discoveredJSRoutes.push(route.endpoint);
          const jsKey = `${route.endpoint}_${route.method}`;
          if (!discoveredEndpoints.has(jsKey)) {
            discoveredEndpoints.set(jsKey, {
              url: route.endpoint,
              method: route.method,
              parameters: extractParameters(route.endpoint),
              source: 'javascript'
            });
          }
        }
      }

      // D. Discover Internal Links for Queue
      if (depth < maxDepth) {
        const { links } = discoverUrls(htmlContent, currentUrl, rootUrl);
        for (const link of links) {
          if (!visitedUrls.has(link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    }

    if (browser) {
      await browser.close();
    }

    // 3. Persist Endpoints and Forms to Database
    const endpointDocs = Array.from(discoveredEndpoints.values()).map(ep => ({
      scanId: scan._id,
      url: ep.url,
      method: ep.method,
      parameters: ep.parameters,
      source: ep.source
    }));

    if (endpointDocs.length > 0) {
      await Endpoint.insertMany(endpointDocs);
    }

    if (discoveredForms.length > 0) {
      await Form.insertMany(discoveredForms);
    }

    // 4. Complete Scan Record (Step 1 Complete)
    scan.status = 'completed';
    scan.urlsDiscoveredCount = visitedUrls.size;
    scan.completedAt = new Date();
    await scan.save();

    return {
      scanId: scan._id,
      targetUrl: rootUrl,
      status: 'completed',
      step: 1,
      message: 'Step 1 Complete: Pure endpoints with input fields extracted.',
      urlsDiscovered: Array.from(visitedUrls),
      endpointsCount: endpointDocs.length,
      formsCount: discoveredForms.length
    };


  } catch (error) {
    console.error('[Crawler] Scan failed:', error);
    scan.status = 'failed';
    scan.error = error.message;
    await scan.save();
    if (browser) await browser.close();
    throw error;
  }
};

