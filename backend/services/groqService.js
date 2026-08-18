import Groq from 'groq-sdk';
import { searchOWASP } from './owaspSearchService.js';
import { getLearnedRulesFormatted } from './feedbackService.js';

export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key')) {
    return null;
  }
  return new Groq({ apiKey });
};

// Clean Cybersecurity Security Assistant System Prompt
const CYBER_SECURITY_SYSTEM_PROMPT = `You are Cyber AI Brain, an expert cybersecurity assistant, vulnerability researcher, and OWASP security consultant.

Your role:
- Help users understand web security concepts, OWASP Top 10 guidelines, vulnerability remediation, and secure code practices.
- When live reconnaissance scan results from web crawlers (Katana, GoSpider, Hakrawler, Arjun, Playwright) are provided in the prompt context, present the discovered endpoints, URLs, and HTTP parameters clearly in formatted markdown, analyze potential vulnerability attack vectors (such as SQL Injection, XSS, SSRF, LFI, Open Redirect), and provide actionable security testing and defense recommendations.
- When Dalfox XSS scan findings are provided in the context, DO NOT list out the raw findings, payloads, or parameters line-by-line, as they are already displayed visually in the UI. Instead, provide a high-level summary of the vulnerability types found, and focus entirely on providing actionable remediation guidance and defense strategies.
- When Stored XSS Canary Scanner findings are provided in the context, explain the persistence mechanism clearly: describe how the injected marker was stored server-side and later rendered in a victim's browser session. For each finding, identify the vulnerable parameter, the HTML rendering context (html_body means the value appears directly in the HTML DOM; html_attribute means it appears inside an HTML tag attribute value; js_variable means it is embedded inside a JavaScript block), and provide precise and targeted remediation steps including: (1) context-aware output encoding using the appropriate encoding function for the rendering context, (2) server-side HTML sanitization using a library such as DOMPurify or sanitize-html if rich text input is required, (3) a strict Content-Security-Policy header configuration, and (4) marking session cookies with the HttpOnly flag to prevent session hijacking even if XSS is triggered.`;


export const generateAIResponse = async (conversationHistory = [], scanData = null) => {
  const groq = getGroqClient();
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  // Extract last user prompt
  const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
  const userQuery = lastUserMsg ? lastUserMsg.content : '';

  // RAG Search on OWASP Chunks
  const owaspContextChunks = userQuery ? searchOWASP(userQuery, 3) : [];
  let owaspContextText = '';
  if (owaspContextChunks.length > 0) {
    owaspContextText = '\n\nOWASP REFERENCE KNOWLEDGE:\n' +
      owaspContextChunks.map(c => `[${c.source}]: ${c.text}`).join('\n\n');
  }

  // Load Reconnaissance Scan Context (Katana, GoSpider, Hakrawler, Arjun)
  let scanContextText = '';
  if (scanData) {
    scanContextText = `\n\nRECONNAISSANCE SCAN RESULTS FOR '${scanData.domain}':\n`;
    
    if (scanData.scanners) {
      if (scanData.scanners.katana) {
        scanContextText += `[Katana Crawler]: Found ${scanData.scanners.katana.count} URLs\n`;
      }
      if (scanData.scanners.gospider) {
        scanContextText += `[GoSpider Crawler]: Found ${scanData.scanners.gospider.count} URLs\n`;
      }
      if (scanData.scanners.hakrawler) {
        scanContextText += `[Hakrawler Endpoint Discovery]: Found ${scanData.scanners.hakrawler.count} URLs\n`;
      }
      if (scanData.scanners.arjun) {
        scanContextText += `[Arjun Parameter Discovery]: Found ${scanData.scanners.arjun.count} Parameters\n`;
      }
      if (scanData.scanners.playwright) {
        scanContextText += `[Playwright Browser Crawler]: Found ${scanData.scanners.playwright.count} URLs and ${scanData.scanners.playwright.paramsCount || 0} Parameters\n`;
      }
      if (scanData.scanners.dalfox) {
        const df = scanData.scanners.dalfox;
        scanContextText += `[Dalfox XSS Scanner]: Scanned ${df.urlsScanned || 1} URLs — ${df.totalFindings} total findings (${df.verified} verified, ${df.reflected} reflected)${df.urlsCapped ? ' (URL list was capped at 50)' : ''}\n`;
        if (df.findings && df.findings.length > 0) {
          scanContextText += `\n[DALFOX XSS FINDINGS DETAIL]:\n`;
          df.findings.slice(0, 30).forEach((f, i) => {
            scanContextText += `Finding #${i + 1}:\n`;
            if (f.type) scanContextText += `  Type: ${f.type}\n`;
            if (f.severity) scanContextText += `  Severity: ${f.severity}\n`;
            if (f.param) scanContextText += `  Parameter: ${f.param}\n`;
            if (f.payload) scanContextText += `  Payload: ${f.payload}\n`;
            if (f.evidence || f.poc) scanContextText += `  Evidence: ${f.evidence || f.poc}\n`;
            if (f.url || f.inject_url) scanContextText += `  URL: ${f.url || f.inject_url}\n`;
            if (f.cwe) scanContextText += `  CWE: ${f.cwe}\n`;
            scanContextText += `\n`;
          });
        }
      }

      // Stored XSS Canary Scanner results
      if (scanData.scanners.storedXss) {
        const sx = scanData.scanners.storedXss;
        scanContextText += `[Stored XSS Canary Scanner]: Submitted ${sx.formsSubmitted} form(s), verified ${sx.pagesVerified} page(s) — ${sx.totalFindings} Stored XSS finding(s)\n`;
        if (sx.findings && sx.findings.length > 0) {
          scanContextText += `\n[STORED XSS FINDINGS DETAIL]:\n`;
          sx.findings.slice(0, 20).forEach((f, i) => {
            scanContextText += `Stored XSS Finding #${i + 1}:\n`;
            scanContextText += `  Severity: ${f.severity || 'HIGH'}\n`;
            scanContextText += `  Injection Parameter: '${f.injectionParam}' on ${f.injectionUrl}\n`;
            scanContextText += `  Canary Reflected On: ${f.reflectedOnUrl}\n`;
            scanContextText += `  HTML Rendering Context: ${f.context}\n`;
            if (f.surroundingHtml) scanContextText += `  Surrounding HTML Context: ${f.surroundingHtml.slice(0, 200)}\n`;
            scanContextText += `\n`;
          });
        } else {
          scanContextText += `  No Stored XSS vulnerabilities detected by canary injection.\n`;
        }
      }
    }

    if (scanData.unifiedResults) {
      const u = scanData.unifiedResults;
      scanContextText += `\n[CROSS-TOOL DEDUPLICATED FINAL OUTPUT]:\n` +
        `Total Unique Discovered URLs: ${u.totalUniqueUrls}\n` +
        (u.urls && u.urls.length > 0 ? `Unique URLs:\n${u.urls.slice(0, 50).join('\n')}\n` : 'No unique URLs found.\n') +
        `Total Unique Parameters: ${u.totalUniqueParams}\n` +
        (u.params && u.params.length > 0 ? `Unique Parameters:\n${u.params.join(', ')}\n` : '');
    }
  }

  // Load persistent learned rules from user feedback
  const learnedRulesText = getLearnedRulesFormatted();

  const fullSystemContent = `${CYBER_SECURITY_SYSTEM_PROMPT}${learnedRulesText}${scanContextText}${owaspContextText}`;

  const systemPromptObj = {
    role: 'system',
    content: fullSystemContent
  };

  const sources = owaspContextChunks.map(c => ({ source: c.source, type: c.document_type || 'OWASP Knowledge' }));

  if (!groq) {
    console.warn('[GroqService] GROQ_API_KEY is missing. Returning fallback response.');
    return {
      content: `> ⚠️ **GROQ API Key Missing**: Please configure your \`GROQ_API_KEY\` in \`backend/.env\` to enable live Groq AI responses.`,
      model: `${model} (Demo)`,
      isDemo: true,
      sources
    };
  }

  try {
    const recentHistory = conversationHistory.slice(-4);
    const formattedMessages = [
      systemPromptObj,
      ...recentHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: formattedMessages,
      model: model,
      temperature: 0.2,
      max_tokens: 2048,
    });

    const aiContent = chatCompletion.choices[0]?.message?.content || 'No response generated.';

    return {
      content: aiContent,
      model: model,
      isDemo: false,
      sources
    };

  } catch (error) {
    console.error('[GroqService] Error querying Groq API:', error.message);
    throw new Error(error.message || 'Failed to generate AI response.');
  }
};
