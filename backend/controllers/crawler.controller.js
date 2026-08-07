import { validateTargetUrl } from '../crawler/crawler.utils.js';
import { crawlWebsite } from '../crawler/crawler.service.js';
import { runSemgrepXSS, checkSemgrepInstalled } from '../services/semgrepService.js';
import { Scan } from '../models/Scan.js';
import { Endpoint } from '../models/Endpoint.js';
import { Form } from '../models/Form.js';

/**
 * Controller: POST /api/crawler/start
 * Validates target URL, starts crawler process, and returns scanId.
 */
export const startCrawl = async (req, res) => {
  const { url, maxDepth = 3, maxUrls = 50 } = req.body;

  const validation = validateTargetUrl(url);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.reason
    });
  }

  try {
    // Initiate background crawl
    const targetUrl = validation.normalizedUrl;
    
    // Create Scan document immediately
    const scan = await Scan.create({
      targetUrl,
      status: 'pending'
    });

    // Run crawl process (async)
    crawlWebsite(targetUrl, { maxDepth, maxUrls })
      .catch(err => console.error(`[CrawlerController] Background crawl ${scan._id} failed:`, err.message));

    return res.status(202).json({
      success: true,
      scanId: scan._id,
      message: 'Crawler started successfully',
      targetUrl
    });

  } catch (error) {
    console.error('[CrawlerController] Error starting crawl:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to start crawler process'
    });
  }
};

/**
 * Controller: GET /api/crawler/results/:scanId
 * Retrieves discovered endpoints, forms, and JavaScript routes for a scan.
 */
export const getScanResults = async (req, res) => {
  const { scanId } = req.params;

  try {
    const scan = await Scan.findById(scanId).lean();
    if (!scan) {
      return res.status(404).json({ success: false, error: 'Scan session not found' });
    }

    const endpoints = await Endpoint.find({ scanId }).lean();
    const forms = await Form.find({ scanId }).lean();

    const javascriptRoutes = endpoints
      .filter(ep => ep.source === 'javascript')
      .map(ep => ({ endpoint: ep.url, method: ep.method }));

    return res.json({
      success: true,
      scan: {
        scanId: scan._id,
        targetUrl: scan.targetUrl,
        status: scan.status,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        error: scan.error
      },
      endpoints: endpoints.map(ep => ({
        url: ep.url,
        method: ep.method,
        parameters: ep.parameters,
        source: ep.source
      })),
      forms: forms.map(f => ({
        endpoint: f.endpoint,
        method: f.method,
        inputs: f.inputs
      })),
      javascriptRoutes
    });

  } catch (error) {
    console.error('[CrawlerController] Error retrieving results:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve scan results'
    });
  }
};

/**
 * Controller: POST /api/crawler/inspect-dom
 * Step 2: Visits endpoint(s) with Playwright waiting for networkidle and returns raw DOM HTML content ("Inspect Element").
 * 
 * For POST form-action endpoints (e.g. /Xss/Add), Playwright's page.goto() uses GET,
 * which may return an empty page. In that case, we automatically fall back to fetching
 * the parent page that contains the form.
 */
export const inspectEndpointDOMController = async (req, res) => {
  const { url, urls, method, waitUntil = 'networkidle', timeout = 30000 } = req.body;

  try {
    if (urls && Array.isArray(urls) && urls.length > 0) {
      const { inspectEndpointsDOMBatch } = await import('../crawler/playwrightVisitor.js');
      const results = await inspectEndpointsDOMBatch(urls, { waitUntil, timeout });
      return res.json({ success: true, count: results.length, results });
    }

    if (!url) {
      return res.status(400).json({ success: false, error: 'Target url or urls array is required' });
    }

    const { inspectEndpointDOM } = await import('../crawler/playwrightVisitor.js');
    let result = await inspectEndpointDOM(url, { waitUntil, timeout });

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
          // Remove the last segment (e.g., /Xss/Add → /Xss)
          pathSegments.pop();
          parsedUrl.pathname = '/' + pathSegments.join('/');
          const parentUrl = parsedUrl.href;
          
          console.log(`[CrawlerController] POST endpoint ${url} returned empty body. Falling back to parent page: ${parentUrl}`);
          const parentResult = await inspectEndpointDOM(parentUrl, { waitUntil, timeout });
          
          if (parentResult.htmlContent && parentResult.htmlContent.replace(/\s/g, '').length > 100) {
            result = parentResult;
            result.note = `POST endpoint ${url} returned empty body. Showing parent page: ${parentUrl}`;
          }
        }
      } catch (parentErr) {
        console.warn('[CrawlerController] Parent URL fallback failed:', parentErr.message);
      }
    }

    return res.json({
      success: true,
      url: result.url,
      status: result.status,
      contentLength: result.contentLength,
      htmlContent: result.htmlContent,
      note: result.note || null,
      error: result.error
    });
  } catch (error) {
    console.error('[CrawlerController] DOM inspection failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Controller: POST /api/crawler/semgrep-scan
 * Step 3: Run Semgrep XSS static analysis on extracted source code from Step 2.
 * 
 * Body: { sourceCode: string, fileType?: 'html' | 'js', url?: string }
 * Returns: { success, verdict, findingsCount, findings[], executionTimeMs }
 */
export const semgrepScanController = async (req, res) => {
  const { sourceCode, fileType = 'html', url = '' } = req.body;

  if (!sourceCode || typeof sourceCode !== 'string' || sourceCode.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'sourceCode is required. Fetch the DOM in Step 2 first.'
    });
  }

  try {
    console.log(`[SemgrepController] Running Semgrep XSS scan on ${url || 'provided source'} (${sourceCode.length} chars, type: ${fileType})...`);
    
    const result = await runSemgrepXSS(sourceCode, fileType, url);

    console.log(`[SemgrepController] Semgrep verdict: ${result.verdict} (${result.findingsCount} findings, ${result.executionTimeMs}ms)`);

    return res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[SemgrepController] Semgrep scan failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Semgrep scan failed'
    });
  }
};

/**
 * Controller: GET /api/crawler/semgrep-status
 * Check if Semgrep CLI is installed and available.
 */
export const semgrepStatusController = async (req, res) => {
  try {
    const status = await checkSemgrepInstalled();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
