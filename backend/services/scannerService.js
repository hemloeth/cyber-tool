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
 * @param {string} domainInput
 * @param {string|null} cookieHeader - Session cookie header string to send with requests.
 */
export async function runKatana(domainInput, cookieHeader = null) {
  return new Promise((resolve) => {
    const katanaPath = resolveToolExecutable('katana');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const args = ['-u', targetUrl, '-silent', '-jc', '-d', '3', '-f', 'qurl'];

    // Inject session cookies if available
    if (cookieHeader) {
      args.push('-H', `Cookie: ${cookieHeader}`);
    }

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
 * @param {string} domainInput
 * @param {string|null} cookieHeader - Session cookie header string to send with requests.
 */
export async function runGoSpider(domainInput, cookieHeader = null) {
  return new Promise((resolve) => {
    const gospiderPath = resolveToolExecutable('gospider');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const args = ['-s', targetUrl, '-d', '3', '--quiet'];

    // Inject session cookies if available
    if (cookieHeader) {
      args.push('-H', `Cookie: ${cookieHeader}`);
    }

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
 * @param {string} domainInput
 * @param {string|null} cookieHeader - Session cookie header string to send with requests.
 */
export async function runHakrawler(domainInput, cookieHeader = null) {
  return new Promise((resolve) => {
    const hakrawlerPath = resolveToolExecutable('hakrawler');
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    // Hakrawler receives target URL via stdin or echo
    const args = ['-d', '3', '-u'];

    // Inject session cookies if available
    if (cookieHeader) {
      args.push('-h', `Cookie: ${cookieHeader}`);
    }

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
 * @param {string} domainInput
 * @param {string|null} cookieHeader - Session cookie header string to send with requests.
 */
export async function runArjun(domainInput, cookieHeader = null) {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const tempJsonPath = path.join(os.tmpdir(), `arjun_${Date.now()}.json`);
    const args = ['-m', 'arjun', '-u', targetUrl, '-oJ', tempJsonPath, '--passive'];

    // Inject session cookies if available
    if (cookieHeader) {
      args.push('--headers', `Cookie: ${cookieHeader}`);
    }

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
 * Creates an authenticated Playwright browser context.
 * Supports session cookie injection, HTTP Basic Auth.
 * @param {import('playwright').Browser} browser
 * @param {object|null} authConfig
 * @param {string} targetDomain - used for cookie domain scoping
 */
async function createAuthenticatedPlaywrightContext(browser, authConfig, targetDomain) {
  const context = await browser.newContext();

  if (authConfig?.type === 'cookie' && authConfig.cookies) {
    // Parse "name=value; name2=value2" cookie string
    const cookiePairs = authConfig.cookies.split(';').map(c => c.trim()).filter(Boolean);
    const cookieObjects = cookiePairs.map(pair => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return null;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      // Extract bare domain (strip http/https/path)
      let domain = targetDomain || '';
      try {
        domain = new URL(domain.startsWith('http') ? domain : `http://${domain}`).hostname;
      } catch (_) {}
      return { name, value, domain, path: '/' };
    }).filter(Boolean);
    if (cookieObjects.length > 0) {
      await context.addCookies(cookieObjects);
      console.log(`[ScannerService] Auth: Injected ${cookieObjects.length} session cookie(s)`);
    }
  }

  if (authConfig?.type === 'basic' && authConfig.username) {
    await context.setHTTPCredentials({
      username: authConfig.username,
      password: authConfig.password || ''
    });
    console.log(`[ScannerService] Auth: HTTP Basic Auth set for user '${authConfig.username}'`);
  }

  return context;
}

/**
 * Performs form-based login using Playwright.
 * Tries common username/password field selectors.
 * @param {import('playwright').Page} page
 * @param {object} authConfig - { loginUrl, username, password }
 */
async function performFormLogin(page, authConfig) {
  if (!authConfig?.loginUrl) return false;
  try {
    console.log(`[ScannerService] Auth: Performing form login at ${authConfig.loginUrl}`);
    await page.goto(authConfig.loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const usernameSelectors = [
      'input[name="username"]', 'input[name="user"]', 'input[name="email"]',
      'input[type="email"]', '#username', '#user', '#loginUsername',
      'input[name="log"]', 'input[autocomplete="username"]'
    ];
    for (const sel of usernameSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, authConfig.username || '');
        break;
      }
    }

    const passwordSelectors = [
      'input[name="password"]', 'input[name="pass"]', 'input[type="password"]',
      '#password', '#pass', '#loginPassword', 'input[name="pwd"]',
      'input[autocomplete="current-password"]'
    ];
    for (const sel of passwordSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, authConfig.password || '');
        break;
      }
    }

    // Try to click a submit button, fallback to Enter key
    const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")');
    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
        submitBtn.click()
      ]);
    } else {
      const passField = await page.$('input[type="password"]');
      if (passField) {
        await Promise.all([
          page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
          passField.press('Enter')
        ]);
      }
    }

    console.log(`[ScannerService] Auth: Form login completed. Current URL: ${page.url()}`);
    return true;
  } catch (loginErr) {
    console.error('[ScannerService] Auth: Form login failed:', loginErr.message);
    return false;
  }
}

/**
 * Centralized authentication step.
 * Runs Playwright login ONCE (if type='login'), extracts all session cookies,
 * and returns a cookie header string that can be passed to every CLI tool.
 *
 * @param {object|null} authConfig - Auth config from the frontend.
 * @param {string} targetDomain - The target domain being scanned.
 * @returns {Promise<{ cookieHeader: string|null, authConfig: object|null }>}
 */
async function authenticateAndExtractCookies(authConfig, targetDomain) {
  if (!authConfig) {
    return { cookieHeader: null, authConfig: null, authVerification: null };
  }

  // Type 'cookie': user already provided raw cookies — use them directly
  if (authConfig.type === 'cookie' && authConfig.cookies) {
    const cookieHeader = authConfig.cookies.trim();
    const cookieNames = cookieHeader.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
    console.log(`[ScannerService] Auth: Using user-provided cookie header (${cookieHeader.length} chars)`);
    return {
      cookieHeader,
      authConfig,
      authVerification: {
        method: 'cookie',
        status: 'provided',
        cookieNames,
        cookieCount: cookieNames.length,
        message: `Using ${cookieNames.length} user-provided cookie(s): ${cookieNames.join(', ')}`
      }
    };
  }

  // Type 'basic': no cookie extraction needed, but we format an Authorization header
  if (authConfig.type === 'basic' && authConfig.username) {
    const basicToken = Buffer.from(`${authConfig.username}:${authConfig.password || ''}`).toString('base64');
    const cookieHeader = null;
    console.log(`[ScannerService] Auth: HTTP Basic Auth configured for user '${authConfig.username}'`);
    return {
      cookieHeader,
      authConfig,
      basicAuthHeader: `Basic ${basicToken}`,
      authVerification: {
        method: 'basic',
        status: 'configured',
        username: authConfig.username,
        message: `HTTP Basic Auth configured for user '${authConfig.username}'`
      }
    };
  }

  // Type 'login': perform Playwright login and extract session cookies
  if (authConfig.type === 'login' && authConfig.loginUrl) {
    let browser;
    try {
      const targets = buildTargetUrls(targetDomain);
      const targetUrl = targets[0];

      console.log(`[ScannerService] Auth: Launching Playwright to perform login at ${authConfig.loginUrl}`);

      try {
        browser = await chromium.launch({ headless: true });
      } catch (launchErr) {
        console.warn('[ScannerService] Auth: Chromium launch failed, trying system Chrome:', launchErr.message);
        browser = await chromium.launch({ headless: true, channel: 'chrome' });
      }

      const context = await browser.newContext();
      const page = await context.newPage();

      // Capture the login page URL before login
      const preLoginUrl = authConfig.loginUrl;

      // Perform form login
      const loginSuccess = await performFormLogin(page, authConfig);

      // Capture post-login state for verification
      const postLoginUrl = page.url();
      const postLoginTitle = await page.title().catch(() => 'Unknown');

      if (!loginSuccess) {
        // Take screenshot even on failure for debugging
        let failScreenshot = null;
        try {
          const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
          failScreenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
        } catch (_) {}

        console.warn('[ScannerService] Auth: Form login did not succeed. Proceeding without cookies.');
        await browser.close().catch(() => {});
        return {
          cookieHeader: null,
          authConfig,
          authVerification: {
            method: 'login',
            status: 'failed',
            loginUrl: preLoginUrl,
            postLoginUrl,
            postLoginTitle,
            screenshot: failScreenshot,
            message: `Login attempt failed. Page stayed at: ${postLoginUrl}`
          }
        };
      }

      // Navigate to the target after login to ensure cookies for the target domain are set
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // Take screenshot of the post-login page as visual proof
      let screenshot = null;
      try {
        const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
        screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
        console.log('[ScannerService] Auth: Post-login screenshot captured');
      } catch (ssErr) {
        console.warn('[ScannerService] Auth: Screenshot capture failed:', ssErr.message);
      }

      // Capture the final page title (after navigating to target)
      const targetPageTitle = await page.title().catch(() => 'Unknown');

      // Extract all cookies from the browser context
      const cookies = await context.cookies();
      await browser.close().catch(() => {});

      if (cookies.length === 0) {
        console.warn('[ScannerService] Auth: Login completed but no cookies were captured.');
        return {
          cookieHeader: null,
          authConfig,
          authVerification: {
            method: 'login',
            status: 'no_cookies',
            loginUrl: preLoginUrl,
            postLoginUrl,
            postLoginTitle,
            targetPageTitle,
            screenshot,
            message: `Login appeared to succeed (redirected to ${postLoginUrl}) but no cookies were captured.`
          }
        };
      }

      // Format cookies as a single header string: "name1=val1; name2=val2; ..."
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const cookieNames = cookies.map(c => c.name);

      console.log(`[ScannerService] Auth: Extracted ${cookies.length} session cookie(s) → cookieHeader: "${cookieHeader.slice(0, 80)}${cookieHeader.length > 80 ? '...' : ''}"`);

      // Also update authConfig so Playwright/Stored-XSS tools can inject cookies directly
      // instead of performing login again
      const enrichedAuthConfig = {
        ...authConfig,
        _extractedCookies: cookies,
        _cookieHeader: cookieHeader
      };

      return {
        cookieHeader,
        authConfig: enrichedAuthConfig,
        authVerification: {
          method: 'login',
          status: 'success',
          loginUrl: preLoginUrl,
          postLoginUrl,
          postLoginTitle,
          targetPageTitle,
          screenshot,
          cookieNames,
          cookieCount: cookies.length,
          message: `✅ Login successful! Redirected to "${postLoginTitle}" (${postLoginUrl}). Extracted ${cookies.length} cookie(s): ${cookieNames.join(', ')}`
        }
      };
    } catch (err) {
      console.error('[ScannerService] Auth: Login + cookie extraction failed:', err.message);
      if (browser) await browser.close().catch(() => {});
      return {
        cookieHeader: null,
        authConfig,
        authVerification: {
          method: 'login',
          status: 'error',
          error: err.message,
          message: `Login failed with error: ${err.message}`
        }
      };
    }
  }

  return { cookieHeader: null, authConfig: null, authVerification: null };
}

/**
 * Runs Playwright headless browser scanner to intercept requests, extract form inputs, and discover search parameters.
 * @param {string} domainInput
 * @param {object|null} authConfig - optional authentication config
 */
export async function runPlaywright(domainInput, authConfig = null) {
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

    const context = await createAuthenticatedPlaywrightContext(browser, authConfig, targets[0]);

    // If form-based login is requested, perform it before main crawl
    if (authConfig?.type === 'login') {
      const loginPage = await context.newPage();
      await performFormLogin(loginPage, authConfig);
      await loginPage.close();
    }
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
 * Resolves the path to the bundled Dalfox binary.
 */
function resolveDalfoxPath() {
  const isWin = process.platform === 'win32';
  const dalfoxDir = path.resolve(__dirname, '..', 'tools', 'dalfox');

  try {
    const entries = fs.readdirSync(dalfoxDir);
    for (const entry of entries) {
      const candidate = path.join(dalfoxDir, entry, isWin ? 'dalfox.exe' : 'dalfox');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (_) {}

  // Fallback: try system PATH or Go bin
  return resolveToolExecutable('dalfox');
}

/**
 * Runs Dalfox XSS scanner against a target URL and optionally
 * also scans additional URLs discovered by crawlers.
 * 
 * @param {string} domainInput - The primary domain or URL to scan.
 * @param {string[]} [discoveredUrls=[]] - Extra URLs found by crawlers (Katana, GoSpider, etc.)
 */
/**
 * Runs Dalfox XSS scanner against a target URL and optionally
 * also scans additional URLs discovered by crawlers.
 * 
 * @param {string} domainInput - The primary domain or URL to scan.
 * @param {string[]} [discoveredUrls=[]] - Extra URLs found by crawlers (Katana, GoSpider, etc.)
 * @param {string|null} cookieHeader - Session cookie header string for authenticated scanning.
 */
export async function runDalfox(domainInput, discoveredUrls = [], cookieHeader = null) {
  return new Promise((resolve) => {
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];
    const dalfoxPath = resolveDalfoxPath();

    // Build the full list of URLs to scan:
    // 1. The original target URL
    // 2. All discovered URLs that contain query parameters (XSS-testable)
    const urlsToScan = new Set();
    urlsToScan.add(targetUrl);

    // Filter discovered URLs: keep only those with query params (most likely XSS targets)
    if (discoveredUrls && discoveredUrls.length > 0) {
      for (const url of discoveredUrls) {
        try {
          const parsed = new URL(url);
          if (parsed.search && parsed.searchParams.toString().length > 0) {
            urlsToScan.add(url);
          }
        } catch (_) {}
      }
    }

    const uniqueUrls = Array.from(urlsToScan);
    // Cap at 50 URLs to keep scan time reasonable (timeout is 2 minutes)
    const MAX_URLS = 50;
    const cappedUrls = uniqueUrls.slice(0, MAX_URLS);

    console.log(`[ScannerService] Dalfox: ${cappedUrls.length} URLs to scan (${uniqueUrls.length} total, capped at ${MAX_URLS})`);

    const tempJsonPath = path.join(os.tmpdir(), `dalfox_${Date.now()}.json`);
    let args;
    let tempUrlsFile = null;

    if (cappedUrls.length === 1) {
      // Single URL mode
      args = [
        'scan', cappedUrls[0],
        '--silence',
        '-o', tempJsonPath,
        '--format', 'json',
        '--workers', '10',
        '--timeout', '30',
        '--follow-redirects',
      ];
    } else {
      // File mode: write all URLs to a temp file and pass it to dalfox
      tempUrlsFile = path.join(os.tmpdir(), `dalfox_urls_${Date.now()}.txt`);
      fs.writeFileSync(tempUrlsFile, cappedUrls.join('\n'), 'utf-8');
      console.log(`[ScannerService] Dalfox URL list written to: ${tempUrlsFile}`);

      args = [
        'scan', tempUrlsFile,
        '--silence',
        '-o', tempJsonPath,
        '--format', 'json',
        '--workers', '10',
        '--timeout', '30',
        '--follow-redirects',
      ];
    }

    // Inject session cookies if available
    if (cookieHeader) {
      args.push('--cookie', cookieHeader);
    }

    console.log(`[ScannerService] Executing Dalfox: ${dalfoxPath} ${args.join(' ')}`);
    const child = spawn(dalfoxPath, args, { timeout: 180000 }); // 3 min timeout for batch

    let stderr = '';
    child.stderr.on('data', data => stderr += data.toString());
    child.on('error', err => console.error('[ScannerService] Dalfox error:', err.message));

    child.on('close', (code) => {
      let findings = [];
      let rawOutput = '';

      // Clean up temp URLs file
      if (tempUrlsFile && fs.existsSync(tempUrlsFile)) {
        try { fs.unlinkSync(tempUrlsFile); } catch (_) {}
      }

      if (fs.existsSync(tempJsonPath)) {
        try {
          rawOutput = fs.readFileSync(tempJsonPath, 'utf-8').trim();

          if (rawOutput) {
            // Dalfox v3 JSON output wraps findings in a top-level object
            if (rawOutput.startsWith('{')) {
              const parsed = JSON.parse(rawOutput);
              findings = parsed.findings || [];
            } else if (rawOutput.startsWith('[')) {
              findings = JSON.parse(rawOutput);
            } else {
              // JSONL format: one JSON object per line
              findings = rawOutput
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                  try { return JSON.parse(line); }
                  catch (_) { return null; }
                })
                .filter(Boolean);
            }
          }

          fs.unlinkSync(tempJsonPath);
        } catch (e) {
          console.error('[ScannerService] Failed to parse Dalfox result JSON:', e.message);
        }
      }

      // Deduplicate findings by combining param and payload
      const uniqueFindingsMap = new Map();
      findings.forEach(f => {
        const uniqueKey = `${f.param || 'unknown'}-${f.payload || 'unknown'}`;
        // Prefer 'verified' over 'reflected' if there are duplicates
        if (!uniqueFindingsMap.has(uniqueKey) || f.type === 'verified') {
          uniqueFindingsMap.set(uniqueKey, f);
        }
      });
      const deduplicatedFindings = Array.from(uniqueFindingsMap.values());

      // Categorize findings
      const vulnerabilities = deduplicatedFindings.filter(f => f.type === 'verified' || f.verified === true);
      const reflections = deduplicatedFindings.filter(f => f.type === 'reflected' || f.type === 'reflection');

      console.log(`[ScannerService] Dalfox completed: ${deduplicatedFindings.length} unique findings (${vulnerabilities.length} verified, ${reflections.length} reflected) across ${cappedUrls.length} URLs`);

      resolve({
        tool: 'dalfox',
        domain: domainInput,
        targetUrl,
        urlsScanned: cappedUrls.length,
        urlsCapped: uniqueUrls.length > MAX_URLS,
        exitCode: code,
        totalFindings: deduplicatedFindings.length,
        verified: vulnerabilities.length,
        reflected: reflections.length,
        findings: deduplicatedFindings,
        stderr: stderr.trim() || undefined
      });
    });
  });
}

/**
 * Runs Stored XSS Canary Detection Scanner.
 * Injects unique marker strings into all discovered forms, then re-crawls all pages
 * to check if the marker persists and appears on a different page (= Stored XSS).
 *
 * @param {string} domainInput - The primary target domain or URL.
 * @param {string[]} discoveredUrls - URLs found by crawlers to re-crawl for verification.
 * @param {object|null} authConfig - Optional authentication configuration.
 */
export async function runStoredXSSScanner(domainInput, discoveredUrls = [], authConfig = null) {
  const findings = [];
  const canaryMap = new Map(); // canaryId -> { injectionUrl, injectionParam, ... }
  let formsSubmitted = 0;
  let pagesVerified = 0;

  let browser;
  try {
    const targets = buildTargetUrls(domainInput);
    const targetUrl = targets[0];

    console.log(`[ScannerService] Starting Enhanced Stored XSS Canary Scanner on: ${targetUrl}`);

    try {
      browser = await chromium.launch({ headless: true });
    } catch (launchErr) {
      browser = await chromium.launch({ headless: true, channel: 'chrome' });
    }

    // ── Phase A: Authenticate if needed ──────────────────────────────────────
    const context = await createAuthenticatedPlaywrightContext(browser, authConfig, targetUrl);

    if (authConfig?.type === 'login') {
      const loginPage = await context.newPage();
      await performFormLogin(loginPage, authConfig);
      await loginPage.close();
    }

    // ── Phase B: Build list of pages to probe for forms / inputs ────────────
    const MAX_INJECTION_PAGES = 30;
    const urlsToProbe = [targetUrl, ...discoveredUrls.filter(u => u && u.startsWith('http'))];
    const uniqueProbeUrls = [...new Set(urlsToProbe)].slice(0, MAX_INJECTION_PAGES);

    console.log(`[ScannerService] Stored XSS: Probing ${uniqueProbeUrls.length} pages for injectable forms & SPA inputs`);

    // ── Phase C: Inject canary markers into forms & standalone inputs ──────
    for (const probeUrl of uniqueProbeUrls) {
      const page = await context.newPage();
      try {
        await page.goto(probeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

        // 1. Discover standard <form> elements
        let formElements = await page.$$('form');
        let formGroups = [];

        if (formElements.length > 0) {
          for (const f of formElements) {
            formGroups.push({ type: 'form', element: f });
          }
        } else {
          // Fallback for SPAs (React/Next.js/Vue): look for standalone inputs outside <form>
          const standaloneInputs = await page.$$(
            'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input:not([type]), textarea'
          );
          if (standaloneInputs.length > 0) {
            const bodyEl = await page.$('body');
            if (bodyEl) {
              formGroups.push({ type: 'spa_container', element: bodyEl });
            }
          }
        }

        for (const group of formGroups) {
          try {
            const container = group.element;
            const inputs = await container.$$(
              'input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], input:not([type]), textarea'
            );
            if (inputs.length === 0) continue;

            // Generate unique canary per injection set
            const canaryTag = Math.random().toString(36).slice(2, 10).toUpperCase();
            const canaryId = `CyberProbe_${canaryTag}`;
            // Executable Canary Payload: sets window.CyberProbe_TAG = 1 upon execution
            const xssCanary = `"><img src=x onerror="window.${canaryId}=1">`;

            const formAction = group.type === 'form'
              ? (await container.getAttribute('action').catch(() => '') || probeUrl)
              : probeUrl;

            const resolvedAction = (() => {
              try { return new URL(formAction, probeUrl).href; } catch (_) { return probeUrl; }
            })();

            let injectedParam = 'unknown';
            let injectedFields = [];

            for (const input of inputs) {
              const name = await input.getAttribute('name').catch(() => '') ||
                           await input.getAttribute('id').catch(() => '') ||
                           await input.getAttribute('placeholder').catch(() => '') || 'field';
              const inputType = (await input.getAttribute('type') || '').toLowerCase();
              const tagName = (await input.evaluate(el => el.tagName) || '').toLowerCase();

              // Skip hidden inputs so anti-CSRF / session tokens remain intact
              if (inputType === 'hidden') continue;

              if (injectedParam === 'unknown') injectedParam = name;

              let fillValue;
              if (inputType === 'email') {
                fillValue = `${canaryId}@xss.test`;
              } else if (inputType === 'url') {
                fillValue = `https://${canaryId}.test`;
              } else if (inputType === 'number' || inputType === 'tel') {
                injectedFields.push({ name, type: inputType, skipped: true });
                continue;
              } else {
                fillValue = xssCanary;
              }

              // Use Playwright force fill + dispatch input & change events for SPA state binding
              await input.evaluate(el => { el.value = ''; });
              await input.fill(fillValue).catch(async () => {
                await input.evaluate((el, val) => {
                  el.value = val;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }, fillValue).catch(() => {});
              });

              injectedFields.push({ name, type: inputType || tagName, value: fillValue.slice(0, 40) });
            }

            if (injectedFields.length === 0) continue;

            // Fill password fields with test value if needed
            const passwordFields = await container.$$('input[type="password"]');
            for (const pw of passwordFields) {
              await pw.fill('TestPass123!').catch(() => {});
            }

            // Submit form & wait for AJAX / Fetch network idle
            let postSubmitUrl = page.url();
            const submitBtn = await container.$(
              'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Post"), button:has-text("Send"), button:has-text("Save"), button'
            );

            if (submitBtn) {
              await submitBtn.click().catch(() => {});
            } else {
              const firstInput = await container.$('input');
              if (firstInput) {
                await firstInput.press('Enter').catch(() => {});
              }
            }

            // Allow background AJAX / Fetch API requests to send and save to backend DB
            await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
            postSubmitUrl = page.url();

            canaryMap.set(canaryId, {
              canaryTag,
              canaryId,
              injectionUrl: resolvedAction,
              postSubmitUrl: postSubmitUrl !== probeUrl ? postSubmitUrl : null,
              injectionParam: injectedParam,
              injectedFields,
              xssCanary,
              probeUrl
            });

            formsSubmitted++;
            console.log(`[ScannerService] Stored XSS: Injected canary '${canaryId}' via ${injectedFields.length} field(s) on ${resolvedAction} (Group: ${group.type})`);

          } catch (formErr) {
            console.warn('[ScannerService] Stored XSS: Form injection warning:', formErr.message);
          }
        }
      } catch (pageErr) {
        console.warn('[ScannerService] Stored XSS: Page probe warning:', pageErr.message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    if (canaryMap.size === 0) {
      console.log('[ScannerService] Stored XSS: No injectable forms or SPA inputs found. Skipping verification.');
    } else {
      // Pause to allow server-side database storage to complete
      await new Promise(r => setTimeout(r, 2000));

      // ── Phase D: Verification — Re-crawl and verify DOM execution ──────────
      const postSubmitUrls = [];
      canaryMap.forEach(meta => {
        if (meta.postSubmitUrl && meta.postSubmitUrl.startsWith('http')) {
          postSubmitUrls.push(meta.postSubmitUrl);
        }
      });

      const verifyUrls = [...postSubmitUrls, targetUrl, ...discoveredUrls.filter(u => u && u.startsWith('http'))];
      const uniqueVerifyUrls = [...new Set(verifyUrls)].slice(0, 60);

      console.log(`[ScannerService] Stored XSS: Verifying canaries across ${uniqueVerifyUrls.length} pages (including ${postSubmitUrls.length} post-submit URLs)`);

      for (const verifyUrl of uniqueVerifyUrls) {
        const vPage = await context.newPage();
        const interceptedApiCanaries = new Map(); // canaryId -> reqUrl
        const dialogExecutions = new Set(); // canaryId

        // Listen for browser dialog alerts triggered by Stored XSS payloads
        vPage.on('dialog', async (dialog) => {
          const msg = dialog.message() || '';
          for (const [canaryId] of canaryMap.entries()) {
            if (msg.includes(canaryId)) {
              dialogExecutions.add(canaryId);
              console.log(`[ScannerService] Stored XSS EXECUTED via alert dialog: '${canaryId}' on ${verifyUrl}`);
            }
          }
          await dialog.dismiss().catch(() => {});
        });

        // Listen for background API / JSON fetch responses carrying canary data
        vPage.on('response', async (response) => {
          try {
            const reqUrl = response.url();
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json') || contentType.includes('text/plain') || reqUrl.includes('/api/')) {
              const resText = await response.text();
              for (const [canaryId, meta] of canaryMap.entries()) {
                if (resText.includes(canaryId) || (meta.xssCanary && resText.includes(meta.xssCanary))) {
                  interceptedApiCanaries.set(canaryId, reqUrl);
                  console.log(`[ScannerService] Stored XSS: Canary '${canaryId}' detected in background API response from ${reqUrl}`);
                }
              }
            }
          } catch (_) {}
        });

        try {
          await vPage.goto(verifyUrl, { waitUntil: 'networkidle', timeout: 20000 }).catch(async () => {
            await vPage.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          });

          await new Promise(r => setTimeout(r, 1500));
          pagesVerified++;

          const html = await vPage.content();

          for (const [canaryId, meta] of canaryMap.entries()) {
            const hasCanaryId = html.includes(canaryId);
            const hasXssPayload = meta.xssCanary && html.includes(meta.xssCanary);
            const hasApiPersistence = interceptedApiCanaries.has(canaryId);

            // Verify browser JS execution of window.CyberProbe_TAG = 1
            const isJsExecutedInDom = await vPage.evaluate((id) => {
              return window[id] === 1;
            }, canaryId).catch(() => false);

            const hasExecuted = isJsExecutedInDom || dialogExecutions.has(canaryId);

            if (!hasCanaryId && !hasXssPayload && !hasApiPersistence && !hasExecuted) continue;

            const isSamePage = verifyUrl === meta.injectionUrl || verifyUrl === meta.probeUrl;

            // Extract surrounding HTML context
            const searchStr = hasXssPayload ? meta.xssCanary : canaryId;
            const idx = html.indexOf(searchStr);
            const surrounding = idx !== -1
              ? html.slice(Math.max(0, idx - 200), idx + searchStr.length + 200)
              : (hasExecuted ? `Executed in Browser DOM (${canaryId})` : `Found via API Response: ${interceptedApiCanaries.get(canaryId) || verifyUrl}`);

            let context_type = 'html_body';
            if (hasApiPersistence && !hasCanaryId && !hasXssPayload) {
              context_type = 'json_api_response';
            } else if (idx !== -1) {
              const beforeCanary = html.slice(Math.max(0, idx - 100), idx);
              if (/value\s*=\s*["'][^"']*$/.test(beforeCanary)) {
                context_type = 'html_attribute';
              } else if (/var\s+\w+\s*=\s*["'][^"']*$/.test(beforeCanary)) {
                context_type = 'js_variable';
              } else if (/<script[^>]*>[^<]*$/.test(html.slice(Math.max(0, idx - 200), idx))) {
                context_type = 'js_variable';
              }
            }

            let severity = 'HIGH';
            let xssConfirmed = false;

            if (hasExecuted || (hasXssPayload && !html.includes('&lt;img'))) {
              severity = 'CRITICAL';
              xssConfirmed = true;
            }

            if (!findings.some(f => f.canaryId === canaryId && f.reflectedOnUrl === verifyUrl)) {
              findings.push({
                type: 'stored_xss',
                severity,
                xssConfirmed,
                injectionUrl: meta.injectionUrl,
                injectionParam: meta.injectionParam,
                injectedFields: meta.injectedFields,
                reflectedOnUrl: verifyUrl,
                apiResponseUrl: interceptedApiCanaries.get(canaryId) || undefined,
                isSamePageReflection: isSamePage,
                context: context_type,
                surroundingHtml: surrounding,
                canaryId,
                payload: meta.xssCanary
              });

              console.log(`[ScannerService] Stored XSS FOUND: canary '${canaryId}' reflected on ${verifyUrl} (context: ${context_type}, severity: ${severity}, xssConfirmed: ${xssConfirmed})`);
            }
          }
        } catch (vErr) {
          console.warn('[ScannerService] Stored XSS: Verification page warning:', vErr.message);
        } finally {
          await vPage.close().catch(() => {});
        }
      }
    }

  } catch (err) {
    console.error('[ScannerService] Stored XSS Scanner error:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  console.log(`[ScannerService] Stored XSS complete: ${findings.length} finding(s), ${formsSubmitted} forms injected, ${pagesVerified} pages verified`);

  return {
    tool: 'stored_xss_canary',
    domain: domainInput,
    findings,
    totalFindings: findings.length,
    formsSubmitted,
    pagesVerified
  };
}

/**
 * Master scanner runner supporting katana, gospider, hakrawler, arjun, playwright, dalfox, stored-xss, or all.
 * When running 'all', crawlers run first, then Dalfox scans ALL discovered URLs for reflected XSS,
 * then the Stored XSS Canary Scanner runs Phase 3.
 *
 * Authentication Flow:
 *   1. authenticateAndExtractCookies() runs Playwright login ONCE (if auth is provided)
 *   2. Extracted session cookies are passed to ALL CLI tools via their cookie flags
 *   3. Playwright & Stored XSS use the enriched authConfig (with _extractedCookies) internally
 *
 * @param {string} domainInput
 * @param {string} tool
 * @param {object|null} authConfig - Optional authentication config
 */
export async function runReconScanner(domainInput, tool = 'all', authConfig = null) {
  const targetHostOrUrl = domainInput.trim();
  console.log(`[ScannerService] Starting recon scan on '${targetHostOrUrl}' with tool: '${tool}'`);

  const results = {
    domain: targetHostOrUrl,
    timestamp: new Date().toISOString(),
    authenticated: !!authConfig,
    scanners: {}
  };

  const selectedTool = tool.toLowerCase();

  try {
    // ── Phase 0: Authenticate and extract session cookies ───────────────────
    let cookieHeader = null;
    let enrichedAuthConfig = authConfig;

    if (authConfig) {
      console.log(`[ScannerService] Auth config provided (type: ${authConfig.type}). Running centralized authentication...`);
      const authResult = await authenticateAndExtractCookies(authConfig, targetHostOrUrl);
      cookieHeader = authResult.cookieHeader;
      enrichedAuthConfig = authResult.authConfig || authConfig;

      // Store auth verification data for frontend display
      results.authVerification = authResult.authVerification;

      if (cookieHeader) {
        console.log(`[ScannerService] ✓ Session cookies extracted. All CLI tools will scan as authenticated user.`);
        results.authStatus = 'authenticated';
        results.cookiesExtracted = cookieHeader.split(';').length;
      } else if (authResult.basicAuthHeader) {
        console.log(`[ScannerService] ✓ Basic auth configured. Tools will use Authorization header where supported.`);
        results.authStatus = 'basic_auth';
      } else {
        console.warn(`[ScannerService] ⚠ Auth was provided but no cookies could be extracted. Tools will scan unauthenticated.`);
        results.authStatus = 'failed';
      }
    }

    // ── Phase 1: Run crawlers first to discover URLs ─────────────────────────
    if (selectedTool === 'katana' || selectedTool === 'all') {
      results.scanners.katana = await runKatana(targetHostOrUrl, cookieHeader);
    }
    if (selectedTool === 'gospider' || selectedTool === 'all') {
      results.scanners.gospider = await runGoSpider(targetHostOrUrl, cookieHeader);
    }
    if (selectedTool === 'hakrawler' || selectedTool === 'all') {
      results.scanners.hakrawler = await runHakrawler(targetHostOrUrl, cookieHeader);
    }
    if (selectedTool === 'arjun' || selectedTool === 'all') {
      results.scanners.arjun = await runArjun(targetHostOrUrl, cookieHeader);
    }
    if (selectedTool === 'playwright' || selectedTool === 'all') {
      results.scanners.playwright = await runPlaywright(targetHostOrUrl, enrichedAuthConfig);
    }

    // ── Phase 2: Collect all discovered URLs from crawlers, then feed to Dalfox
    if (selectedTool === 'dalfox' || selectedTool === 'all') {
      const crawlerUrls = [];
      for (const key of Object.keys(results.scanners)) {
        const scannerOutput = results.scanners[key];
        if (scannerOutput && Array.isArray(scannerOutput.urls)) {
          scannerOutput.urls.forEach(url => {
            if (url && typeof url === 'string') {
              crawlerUrls.push(url.trim());
            }
          });
        }
      }

      console.log(`[ScannerService] Feeding ${crawlerUrls.length} crawler-discovered URLs to Dalfox for XSS testing`);
      results.scanners.dalfox = await runDalfox(targetHostOrUrl, crawlerUrls, cookieHeader);
    }

    // ── Phase 3: Stored XSS Canary Scanner ──────────────────────────────────
    if (selectedTool === 'stored-xss' || selectedTool === 'all') {
      const allDiscoveredUrls = [];
      for (const key of Object.keys(results.scanners)) {
        const s = results.scanners[key];
        if (s && Array.isArray(s.urls)) {
          s.urls.forEach(u => { if (u) allDiscoveredUrls.push(u); });
        }
      }
      console.log(`[ScannerService] Phase 3: Starting Stored XSS Canary Scanner with ${allDiscoveredUrls.length} discovered URLs`);
      results.scanners.storedXss = await runStoredXSSScanner(targetHostOrUrl, allDiscoveredUrls, enrichedAuthConfig);
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
