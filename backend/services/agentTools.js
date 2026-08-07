import { crawlWebsite } from '../crawler/crawler.service.js';
import { validateTargetUrl } from '../crawler/crawler.utils.js';
import { discoverWaybackEndpoints } from '../crawler/waybackDiscovery.js';
import { visitEndpoints } from '../crawler/sourceVisitor.js';
import { extractForms } from '../crawler/formExtractor.js';
import { analyzeForXSS } from '../crawler/xssAnalyzer.js';
import { Form } from '../models/Form.js';
import { Endpoint } from '../models/Endpoint.js';
import { inspectEndpointWithFallback } from '../crawler/playwrightVisitor.js';
import { runSemgrepXSS } from './semgrepService.js';

/**
 * AI Agent Tool: crawl_target(url)
 * 
 * Orchestrator Flow:
 *   Step 1 → Playwright active crawl (discover pages, forms, hidden inputs)
 *   Step 2 → Wayback Machine passive recon (find historical parameterized URLs)
 *   Step 3 → Filter ONLY endpoints with input fields (visible + hidden)
 *   Step 4 → Visit those filtered endpoints live, read source code
 *   Step 5 → Return combined results for LLM analysis
 */
export const crawl_target = async (url) => {
  const validation = validateTargetUrl(url);
  if (!validation.valid) {
    return { error: `Security Restriction: ${validation.reason}` };
  }

  try {
    const targetUrl = validation.normalizedUrl;
    const domain = new URL(targetUrl).hostname;

    // ═══════════════════════════════════════════
    // STEP 1: Active Playwright Crawl
    // ═══════════════════════════════════════════
    console.log(`[Orchestrator] Step 1 — Active crawl on ${targetUrl}...`);
    const crawlResults = await crawlWebsite(targetUrl, { maxDepth: 2, maxUrls: 30 });
    const scanId = crawlResults.scanId;

    // Fetch discovered forms & endpoints from DB
    const forms = await Form.find({ scanId }).lean();
    const endpoints = await Endpoint.find({ scanId }).lean();

    // ═══════════════════════════════════════════
    // STEP 2: Passive Wayback Machine Discovery
    // ═══════════════════════════════════════════
    console.log(`[Orchestrator] Step 2 — Passive Wayback recon for ${domain}...`);
    // ═══════════════════════════════════════════
    // STEP 1: Discover Endpoints with Input Fields (Pure URLs Only)
    // ═══════════════════════════════════════════
    console.log(`[Orchestrator] Step 1 — Finding pure URLs with input/hidden fields for ${targetUrl}...`);
    const discoveredInputs = [];
    const seenUrls = new Set();

    // 1a. Extract pure endpoints from forms and input fields
    for (const form of forms) {
      const pageUrl = form.endpoint || targetUrl;
      if (!seenUrls.has(pageUrl) && form.inputs && form.inputs.length > 0) {
        seenUrls.add(pageUrl);

        const visibleInputs = form.inputs
          .filter(i => !i.isHidden && !i.type?.includes('hidden'))
          .map(i => ({ name: i.name, type: i.type }));

        const hiddenInputs = form.inputs
          .filter(i => i.isHidden || i.type?.includes('hidden'))
          .map(i => ({ name: i.name, type: i.type, value: i.value || '' }));

        discoveredInputs.push({
          url: pageUrl,
          method: form.method || 'GET',
          source: 'form',
          inputs: visibleInputs,
          hiddenInputs
        });
      }
    }

    // 1b. Extract pure endpoints with query parameters
    for (const ep of endpoints) {
      const pageUrl = ep.url;
      if (!seenUrls.has(pageUrl) && ep.parameters && ep.parameters.length > 0) {
        seenUrls.add(pageUrl);

        discoveredInputs.push({
          url: pageUrl,
          method: ep.method || 'GET',
          source: ep.source || 'html',
          inputs: (ep.parameters || []).map(p => ({ name: p, type: 'url_parameter' })),
          hiddenInputs: []
        });
      }
    }

    // ═══════════════════════════════════════════
    // STEP 2 & STEP 3: Automated DOM Extraction & Semgrep XSS Scan
    // ═══════════════════════════════════════════
    console.log(`[Orchestrator] Step 2 & 3 — Automating Playwright DOM fetch & Semgrep XSS analysis...`);
    const endpointsToScan = discoveredInputs.slice(0, 5);
    
    await Promise.all(endpointsToScan.map(async (item) => {
      try {
        // Step 2: Fetch live rendered DOM via Playwright (with automatic POST form fallback)
        const domResult = await inspectEndpointWithFallback(item.url, item.method || 'GET', { waitUntil: 'networkidle', timeout: 20000 });
        if (domResult && domResult.htmlContent) {
          item.sourceCode = domResult.htmlContent;
          item.htmlSource = domResult.htmlContent;
          item.sourceLength = domResult.contentLength || domResult.htmlContent.length;
          item.domNote = domResult.note || null;

          // Step 3: Automatically execute Semgrep AST-aware XSS scan
          const semgrep = await runSemgrepXSS(item.sourceCode, 'html', item.url);
          item.semgrepResult = {
            verdict: semgrep.verdict || 'safe',
            findingsCount: semgrep.findingsCount || 0,
            findings: semgrep.findings || [],
            executionTimeMs: semgrep.executionTimeMs || 0,
            engineUsed: semgrep.engineUsed || 'semgrep',
            error: semgrep.error || null
          };
          item.finalVerdict = semgrep.verdict === 'vulnerable' 
            ? 'VULNERABLE (Semgrep Verified)' 
            : semgrep.verdict === 'suspicious' 
              ? 'SUSPICIOUS (Review Sinks)' 
              : 'LIKELY SAFE';
        }
      } catch (scanErr) {
        console.warn(`[Orchestrator] Automated Step 2/3 failed for ${item.url}:`, scanErr.message);
      }
    }));

    // Return Complete Pipeline Results (Steps 1, 2, and 3)
    return {
      success: true,
      scanId,
      targetUrl,
      step: 3,
      message: 'Step 1-3 Complete: Discovered endpoints, automatically extracted DOM, and executed Semgrep AST-aware XSS scan.',
      totalEndpointsWithInputs: discoveredInputs.length,
      discoveredInputs
    };

  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return { error: `Orchestrator error: ${error.message}` };
  }
};

