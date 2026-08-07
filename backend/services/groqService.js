import Groq from 'groq-sdk';
import { searchOWASP } from './owaspSearchService.js';
import { crawl_target } from './agentTools.js';
import { validateTargetUrl } from '../crawler/crawler.utils.js';
import { getLearnedRulesFormatted } from './feedbackService.js';
import { runSemgrepXSS, formatSemgrepForLLM } from './semgrepService.js';

export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key')) {
    return null;
  }
  return new Groq({ apiKey });
};

// Clean Input-Endpoint Discovery System Prompt (Pure Endpoints Only)
const RECON_INPUT_FOCUSED_PROMPT = `You are a web security input endpoint discovery assistant.

STEP 1: List all endpoints that contain input fields (visible or hidden).

STRICT OUTPUT RULES:
- Output ONLY strict valid JSON inside a \`\`\`json ... \`\`\` codeblock.
- For each endpoint with inputs:
  1. Show pure endpoint URL and HTTP method
  2. Show visible input fields and hidden input fields

JSON OUTPUT FORMAT:
\`\`\`json
{
  "target": "https://target-url.com",
  "discoveredInputs": [
    {
      "url": "https://target-url.com/login",
      "method": "POST",
      "inputs": [
        { "name": "username", "type": "text" },
        { "name": "password", "type": "password" }
      ],
      "hiddenInputs": [
        { "name": "_csrf", "type": "hidden", "value": "abc123" }
      ]
    }
  ]
}
\`\`\``;


export const generateAIResponse = async (conversationHistory = []) => {
  const groq = getGroqClient();
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  // Extract last user prompt
  const lastUserMsg = conversationHistory.filter(m => m.role === 'user').pop();
  const userQuery = lastUserMsg ? lastUserMsg.content : '';

  // Detect target URL in prompt
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const urlMatch = userQuery.match(urlRegex);

  let crawlDataText = '';
  let crawlSources = [];
  let crawlResult = null;

  if (urlMatch || userQuery.toLowerCase().includes('scan') || userQuery.toLowerCase().includes('analyze') || userQuery.toLowerCase().includes('form')) {
    const targetUrl = urlMatch ? urlMatch[1] : null;
    if (targetUrl) {
      const validation = validateTargetUrl(targetUrl);
      if (validation.valid) {
        console.log(`[ReconAgent] Auto-triggering direct input crawler for ${validation.normalizedUrl}...`);
        crawlResult = await crawl_target(validation.normalizedUrl);
        if (crawlResult.success) {
          // Build input fields + XSS analysis summary (without bulky source code)
          const inputsSummary = crawlResult.discoveredInputs.map(d => ({
            url: d.url,
            method: d.method,
            source: d.source,
            inputs: d.inputs,
            hiddenInputs: d.hiddenInputs,
            sourceLength: d.sourceLength || 0,
            semgrepVerdict: d.semgrepResult?.verdict || null,
            finalVerdict: d.finalVerdict || null,
            xssAnalysis: d.xssAnalysis || null
          }));

          // Build source code section for visited endpoints (trimmed to 1500 chars each to fit Groq 12k TPM limit)
          const visitedInputs = crawlResult.discoveredInputs.filter(d => d.sourceCode).slice(0, 4);
          const sourceSnippets = visitedInputs
            .map(d => `--- SOURCE: ${d.url} (${d.sourceLength} chars) ---\n${d.sourceCode.slice(0, 1500)}`)
            .join('\n\n');

          // Build XSS findings summary
          const xssReport = crawlResult.discoveredInputs
            .filter(d => d.xssAnalysis && d.xssAnalysis.findingsCount > 0)
            .map(d => {
              const a = d.xssAnalysis;
              const findings = a.findings.map(f => `  • ${f.pattern} (${f.occurrences}x) — snippet: ${f.snippet}`).join('\n');
              const prots = a.protections.length > 0 ? `  Protections: ${a.protections.join(', ')}` : '  Protections: NONE';
              return `[${a.riskLevel.toUpperCase()} RISK] ${d.url}\n${findings}\n${prots}`;
            })
            .join('\n\n');

          crawlDataText = `\n\nDISCOVERED INPUT ENDPOINTS:\n${JSON.stringify({
            target: crawlResult.targetUrl,
            waybackEndpointsFound: crawlResult.waybackEndpointsFound,
            endpointsVisitedLive: crawlResult.endpointsVisitedLive,
            discoveredInputs: inputsSummary
          }, null, 2)}`;

          if (xssReport) {
            crawlDataText += `\n\nXSS STATIC ANALYSIS FINDINGS (Regex):\n${xssReport}`;
          }

          // Report Automated Step 3 Semgrep AST-aware XSS Analysis
          try {
            const semgrepResults = crawlResult.discoveredInputs
              .filter(d => d.semgrepResult && d.semgrepResult.findingsCount > 0)
              .map(d => ({ ...d.semgrepResult, url: d.url }));

            if (semgrepResults.length > 0) {
              const semgrepReport = semgrepResults.map(r => formatSemgrepForLLM(r)).join('\n\n');
              crawlDataText += `\n\nSEMGREP AST-AWARE XSS ANALYSIS (AUTOMATED STEP 3 VERDICTS):\n${semgrepReport}`;
            }
          } catch (semErr) {
            console.warn('[GroqService] Semgrep reporting skipped:', semErr.message);
          }

          if (sourceSnippets) {
            crawlDataText += `\n\nLIVE PAGE SOURCE CODE (for deeper analysis):\n${sourceSnippets}`;
          }

          crawlSources.push({ source: 'Orchestrator_Crawler', type: 'discovery_engine' });
        }
      }
    }
  }

  // RAG Search on OWASP Chunks
  const owaspContextChunks = userQuery ? searchOWASP(userQuery, 2) : [];
  let owaspContextText = '';
  if (owaspContextChunks.length > 0) {
    owaspContextText = '\n\nOWASP REFERENCE KNOWLEDGE:\n' +
      owaspContextChunks.map(c => `[${c.source}]: ${c.text}`).join('\n\n');
  }

  // Load persistent learned rules from user feedback
  const learnedRulesText = getLearnedRulesFormatted();

  const fullSystemContent = `${RECON_INPUT_FOCUSED_PROMPT}${learnedRulesText}${crawlDataText}${owaspContextText}`;

  const systemPromptObj = {
    role: 'system',
    content: fullSystemContent
  };

  if (!groq) {
    console.warn('[GroqService] GROQ_API_KEY is missing. Returning demo fallback.');
    return {
      content: `Target: **${urlMatch ? urlMatch[1] : 'https://example.com'}**\n\n> ⚠️ Please configure your \`GROQ_API_KEY\` in \`backend/.env\` to enable live AI analysis.`,
      model: `${model} (Demo)`,
      isDemo: true,
      sources: crawlSources
    };
  }

  try {
    // Keep only last 3 messages to avoid TPM rate limit overflow
    const recentHistory = conversationHistory.slice(-3);
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
      temperature: 0.2, // Low temperature for high factual accuracy
      max_tokens: 2048,
    });

    let aiContent = chatCompletion.choices[0]?.message?.content || 'No input fields discovered.';

    // Inject exact source code, htmlSource, and jsScripts into card objects for DevTools Modal Inspector
    if (crawlResult && crawlResult.discoveredInputs) {
      try {
        const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed && Array.isArray(parsed.discoveredInputs)) {
            for (const item of parsed.discoveredInputs) {
              const matchedCrawl = crawlResult.discoveredInputs.find(c => {
                if (c.url === item.url) return true;
                if (c.url.endsWith(item.url) || item.url.endsWith(c.url)) return true;
                try {
                  const path = new URL(c.url).pathname;
                  return path === item.url || path.replace(/\/$/, '') === item.url.replace(/\/$/, '');
                } catch {
                  return false;
                }
              });

              if (matchedCrawl) {
                item.sourceCodeSnippet = matchedCrawl.sourceCode ? matchedCrawl.sourceCode.slice(0, 8000) : '';
                item.htmlSource = matchedCrawl.htmlSource || '';
                item.jsScripts = matchedCrawl.jsScripts || [];
                item.sourceLength = matchedCrawl.sourceLength || 0;
                item.semgrepResult = matchedCrawl.semgrepResult || null;
                item.finalVerdict = matchedCrawl.finalVerdict || null;
              }
            }
            aiContent = '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
          }
        }
      } catch (e) {
        console.warn('[GroqService] Source inspector data injection skipped:', e.message);
      }
    }

    return {
      content: aiContent,
      model: model,
      isDemo: false,
      sources: [...crawlSources, ...owaspContextChunks.map(c => ({ source: c.source, type: c.document_type }))]
    };

  } catch (error) {
    console.error('[GroqService] Error querying Groq API:', error.message);

    // Graceful Fallback if Groq API hits 429 Rate Limit (TPD / TPM quota reached)
    if (crawlResult && crawlResult.discoveredInputs && (error.status === 429 || error.message.includes('429') || error.message.includes('rate_limit'))) {
      console.log('[GroqService] Groq 429 rate limit hit. Generating fallback response from static crawler findings...');
      
      const formattedCards = crawlResult.discoveredInputs.map(d => {
        const xss = d.xssAnalysis || { riskLevel: 'low', findingsCount: 0, findings: [], protections: [] };
        const isVulnerable = xss.riskLevel === 'high' || xss.riskLevel === 'medium';
        
        return {
          url: d.url,
          method: d.method || 'GET',
          inputs: d.inputs || [],
          hiddenInputs: d.hiddenInputs || [],
          classification: d.source === 'active_crawl' ? 'Live Form Endpoint' : 'Wayback Parameter Endpoint',
          xssVerdict: isVulnerable ? 'Likely Vulnerable' : (xss.findingsCount > 0 ? 'Inconclusive' : 'Likely Safe'),
          xssRiskLevel: xss.riskLevel || 'low',
          sourceAnalysis: xss.findingsCount > 0 
            ? `Static analysis detected ${xss.findingsCount} potential sink/source patterns: ${xss.findings.map(f => f.pattern).join(', ')}.` 
            : `Live DOM tree analyzed. Form inputs are structured securely with no unescaped DOM sinks found in the HTML or JS code.`,
          sourceCodeSnippet: d.sourceCode ? d.sourceCode.slice(0, 8000) : '',
          htmlSource: d.htmlSource || '',
          jsScripts: d.jsScripts || [],
          sourceLength: d.sourceLength || 0,
          semgrepResult: d.semgrepResult || null,
          finalVerdict: d.finalVerdict || null
        };
      });

      const fallbackJson = {
        target: crawlResult.targetUrl,
        discoveredInputs: formattedCards
      };

      return {
        content: `> ⚠️ **Groq AI Token Limit Reached** (Quota resets daily). Generated response directly from live crawler DOM inspection.\n\n\`\`\`json\n${JSON.stringify(fallbackJson, null, 2)}\n\`\`\``,
        model: `${model} (Offline Fallback)`,
        isDemo: true,
        sources: crawlSources
      };
    }

    throw new Error(error.message || 'Failed to generate response from Groq API.');
  }
};
