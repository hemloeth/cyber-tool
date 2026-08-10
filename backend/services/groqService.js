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
- When live reconnaissance scan results from web crawlers (Katana, GoSpider, Hakrawler, Arjun) are provided in the prompt context, present the discovered endpoints, URLs, and HTTP parameters clearly in formatted markdown, analyze potential vulnerability attack vectors (such as SQL Injection, XSS, SSRF, LFI, Open Redirect), and provide actionable security testing and defense recommendations.`;


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
