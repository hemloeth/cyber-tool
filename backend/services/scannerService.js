import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common paths for installed tools
const GO_BIN_DIR = path.join(os.homedir(), 'go', 'bin');

/**
 * Resolves full path for a command executable.
 */
function resolveToolExecutable(toolName) {
  const isWin = process.platform === 'win32';
  const exeName = isWin ? `${toolName}.exe` : toolName;
  const goPathExe = path.join(GO_BIN_DIR, exeName);

  if (fs.existsSync(goPathExe)) {
    return goPathExe;
  }
  return toolName; // fallback to system PATH
}

/**
 * Normalizes input domain/URL into target HTTP/HTTPS URLs.
 */
function buildTargetUrls(domainInput) {
  let raw = domainInput.trim();
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return [raw];
  }
  // Try both http and https
  return [`http://${raw}`, `https://${raw}`];
}

/**
 * Runs Katana web crawler.
 */
export async function runKatana(domainInput) {
  return new Promise((resolve) => {
    const katanaPath = resolveToolExecutable('katana');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const args = ['-u', targetUrl, '-silent', '-jc', '-d', '3', '-f', 'qurl'];

    console.log(`[ScannerService] Executing Katana: ${katanaPath} ${args.join(' ')}`);
    const child = spawn(katanaPath, args, { timeout: 45000 });

    let stdout = '';
    child.stdout.on('data', data => stdout += data.toString());
    child.on('error', err => console.error('[ScannerService] Katana error:', err.message));
    child.on('close', () => {
      const urls = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      resolve({ tool: 'katana', domain: domainInput, count: urls.length, urls });
    });
  });
}

/**
 * Runs GoSpider crawler.
 */
export async function runGoSpider(domainInput) {
  return new Promise((resolve) => {
    const gospiderPath = resolveToolExecutable('gospider');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const args = ['-s', targetUrl, '-d', '3', '--quiet'];

    console.log(`[ScannerService] Executing GoSpider: ${gospiderPath} ${args.join(' ')}`);
    const child = spawn(gospiderPath, args, { timeout: 45000 });

    let stdout = '';
    child.stdout.on('data', data => stdout += data.toString());
    child.on('error', err => console.error('[ScannerService] GoSpider error:', err.message));
    child.on('close', () => {
      const rawLines = stdout.split('\n');
      const urls = rawLines
        .map(line => {
          const match = line.match(/(https?:\/\/[^\s]+)/);
          return match ? match[1] : null;
        })
        .filter(url => url && url.length > 0);

      const uniqueUrls = [...new Set(urls)];
      resolve({ tool: 'gospider', domain: domainInput, count: uniqueUrls.length, urls: uniqueUrls });
    });
  });
}

/**
 * Runs Hakrawler URL/endpoint discoverer.
 */
export async function runHakrawler(domainInput) {
  return new Promise((resolve) => {
    const hakrawlerPath = resolveToolExecutable('hakrawler');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    // Hakrawler receives target URL via stdin or echo
    const args = ['-d', '3', '-u'];

    console.log(`[ScannerService] Executing Hakrawler: echo ${targetUrl} | ${hakrawlerPath} ${args.join(' ')}`);
    const child = spawn(hakrawlerPath, args, { timeout: 45000 });

    let stdout = '';
    child.stdout.on('data', data => stdout += data.toString());
    child.on('error', err => console.error('[ScannerService] Hakrawler error:', err.message));

    // Send target URL to stdin for Hakrawler
    child.stdin.write(`${targetUrl}\n`);
    child.stdin.end();

    child.on('close', () => {
      const urls = stdout.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'));
      const uniqueUrls = [...new Set(urls)];
      resolve({ tool: 'hakrawler', domain: domainInput, count: uniqueUrls.length, urls: uniqueUrls });
    });
  });
}

/**
 * Runs Arjun HTTP Parameter Discovery tool.
 */
export async function runArjun(domainInput) {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const tempJsonPath = path.join(os.tmpdir(), `arjun_${Date.now()}.json`);
    const args = ['-m', 'arjun', '-u', targetUrl, '-oJ', tempJsonPath, '--passive'];

    console.log(`[ScannerService] Executing Arjun: ${pythonCmd} ${args.join(' ')}`);
    const child = spawn(pythonCmd, args, { timeout: 45000 });

    child.on('error', err => console.error('[ScannerService] Arjun error:', err.message));
    child.on('close', () => {
      let paramsFound = [];
      if (fs.existsSync(tempJsonPath)) {
        try {
          const jsonContent = JSON.parse(fs.readFileSync(tempJsonPath, 'utf-8'));
          if (jsonContent && typeof jsonContent === 'object') {
            for (const urlKey of Object.keys(jsonContent)) {
              const urlData = jsonContent[urlKey];
              if (urlData && urlData.params) {
                paramsFound.push(...urlData.params);
              }
            }
          }
          fs.unlinkSync(tempJsonPath);
        } catch (e) {
          console.error('[ScannerService] Failed to read Arjun result JSON:', e.message);
        }
      }
      resolve({ tool: 'arjun', domain: domainInput, count: paramsFound.length, params: paramsFound });
    });
  });
}

/**
 * Runs Playwright headless browser scanner to intercept requests, extract form inputs, and discover search parameters.
 */
export async function runPlaywright(domainInput) {
  const urlsSet = new Set();
  const paramsSet = new Set();

  let browser;
  try {
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];

    console.log(`[ScannerService] Executing Playwright crawler on target: ${targetUrl}`);

    try {
      browser = await chromium.launch({ headless: true });
    } catch (launchErr) {
      console.warn('[ScannerService] Playwright Chromium launch failed, attempting system Chrome fallback:', launchErr.message);
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Intercept network requests (URLs, GET params, and POST body parameters)
    page.on('request', (request) => {
      const reqUrl = request.url();
      if (reqUrl.startsWith('http')) {
        urlsSet.add(reqUrl);
        try {
          const parsed = new URL(reqUrl);
          parsed.searchParams.forEach((_, key) => {
            if (key) paramsSet.add(key);
          });
        } catch (_) {}

        // Capture POST body parameters
        const postData = request.postData();
        if (postData) {
          try {
            const bodyParams = new URLSearchParams(postData);
            bodyParams.forEach((_, key) => {
              if (key) paramsSet.add(key);
            });
          } catch (_) {}
        }
      }
    });

    // 2. Navigate to target URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => {
      console.warn('[ScannerService] Playwright page load warning:', e.message);
    });

    // 3. Collect anchor links
    const pageLinks = await page.$$eval('a[href]', (els) => els.map(e => e.href)).catch(() => []);
    pageLinks.forEach(link => {
      if (link && link.startsWith('http')) {
        urlsSet.add(link);
        try {
          const parsed = new URL(link);
          parsed.searchParams.forEach((_, key) => {
            if (key) paramsSet.add(key);
          });
        } catch (_) {}
      }
    });

    // 4. Extract HTML <form> actions and input parameter names
    const formActionsAndParams = await page.$$eval('form', (forms) => {
      return forms.map((form) => {
        const action = form.getAttribute('action') || '';
        const method = (form.getAttribute('method') || 'GET').toUpperCase();
        const inputs = Array.from(form.querySelectorAll('input, select, textarea'))
          .map((i) => i.getAttribute('name'))
          .filter(Boolean);
        return { action, method, inputs };
      });
    }).catch(() => []);

    formActionsAndParams.forEach((f) => {
      let baseActionUrl = targetUrl;
      if (f.action) {
        try {
          baseActionUrl = new URL(f.action, targetUrl).href;
          urlsSet.add(baseActionUrl);
        } catch (_) {}
      }
      f.inputs.forEach((inputName) => paramsSet.add(inputName));

      // Construct synthetic URL for GET forms (e.g., https://domain.com/?search=test)
      if (f.method === 'GET' && f.inputs.length > 0) {
        try {
          const synthUrl = new URL(baseActionUrl);
          f.inputs.forEach((inputName) => {
            synthUrl.searchParams.set(inputName, 'test');
          });
          urlsSet.add(synthUrl.href);
        } catch (_) {}
      }
    });

    // 5. Fill and submit forms on page (normal forms, search forms, login/signup forms)
    const forms = await page.$$('form');
    if (forms.length > 0) {
      console.log(`[ScannerService] Playwright detected ${forms.length} HTML form(s). Filling and submitting...`);
      for (const form of forms) {
        try {
          // Fill input fields with sample values
          const inputs = await form.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
          for (const input of inputs) {
            const inputType = (await input.getAttribute('type')) || 'text';
            const name = (await input.getAttribute('name')) || '';

            if (inputType === 'password') {
              await input.fill('TestPass123!').catch(() => {});
            } else if (inputType === 'email' || name.toLowerCase().includes('email')) {
              await input.fill('test@example.com').catch(() => {});
            } else {
              await input.fill('test_input').catch(() => {});
            }
          }

          // Trigger submission via submit button or Enter key press
          const submitBtn = await form.$('button[type="submit"], input[type="submit"], button');
          if (submitBtn) {
            await Promise.all([
              page.waitForNavigation({ timeout: 4000 }).catch(() => {}),
              submitBtn.click().catch(() => {})
            ]);
          } else {
            const firstInput = await form.$('input');
            if (firstInput) {
              await Promise.all([
                page.waitForNavigation({ timeout: 4000 }).catch(() => {}),
                firstInput.press('Enter').catch(() => {})
              ]);
            }
          }

          const currentUrl = page.url();
          if (currentUrl && currentUrl.startsWith('http')) {
            urlsSet.add(currentUrl);
            try {
              const parsed = new URL(currentUrl);
              parsed.searchParams.forEach((_, key) => {
                if (key) paramsSet.add(key);
              });
            } catch (_) {}
          }
        } catch (formErr) {
          console.warn('[ScannerService] Playwright form submission warning:', formErr.message);
        }
      }
    }

  } catch (err) {
    console.error('[ScannerService] Playwright execution error:', err.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }

  const urls = Array.from(urlsSet);
  const params = Array.from(paramsSet);
  return {
    tool: 'playwright',
    domain: domainInput,
    count: urls.length,
    urls,
    paramsCount: params.length,
    params
  };
}

/**
 * Master scanner runner supporting katana, gospider, hakrawler, arjun, playwright, or all.
 */
export async function runReconScanner(domainInput, tool = 'all') {
  const targetHostOrUrl = domainInput.trim();
  console.log(`[ScannerService] Starting recon scan on '${targetHostOrUrl}' with tool: '${tool}'`);

  const results = {
    domain: targetHostOrUrl,
    timestamp: new Date().toISOString(),
    scanners: {}
  };

  const selectedTool = tool.toLowerCase();

  try {
    if (selectedTool === 'katana' || selectedTool === 'all') {
      results.scanners.katana = await runKatana(targetHostOrUrl);
    }
    if (selectedTool === 'gospider' || selectedTool === 'all') {
      results.scanners.gospider = await runGoSpider(targetHostOrUrl);
    }
    if (selectedTool === 'hakrawler' || selectedTool === 'all') {
      results.scanners.hakrawler = await runHakrawler(targetHostOrUrl);
    }
    if (selectedTool === 'arjun' || selectedTool === 'all') {
      results.scanners.arjun = await runArjun(targetHostOrUrl);
    }
    if (selectedTool === 'playwright' || selectedTool === 'all') {
      results.scanners.playwright = await runPlaywright(targetHostOrUrl);
    }

    // Cross-tool deduplication across all scanners
    const allUrlsSet = new Set();
    const allParamsSet = new Set();

    for (const key of Object.keys(results.scanners)) {
      const scannerOutput = results.scanners[key];
      if (scannerOutput && Array.isArray(scannerOutput.urls)) {
        scannerOutput.urls.forEach(url => {
          if (url && typeof url === 'string') {
            allUrlsSet.add(url.trim());
          }
        });
      }
      if (scannerOutput && Array.isArray(scannerOutput.params)) {
        scannerOutput.params.forEach(param => {
          if (param && typeof param === 'string') {
            allParamsSet.add(param.trim());
          }
        });
      }
    }

    const uniqueUrlsList = Array.from(allUrlsSet);
    const uniqueParamsList = Array.from(allParamsSet);

    results.unifiedResults = {
      totalUniqueUrls: uniqueUrlsList.length,
      urls: uniqueUrlsList,
      totalUniqueParams: uniqueParamsList.length,
      params: uniqueParamsList
    };

    results.success = true;
    return results;
  } catch (error) {
    console.error('[ScannerService] Recon scan failed:', error);
    return {
      success: false,
      domain: targetHostOrUrl,
      error: error.message
    };
  }
}
