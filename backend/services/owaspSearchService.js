import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to processed OWASP chunks JSONL
const CHUNKS_FILE_PATH = path.resolve(__dirname, '../../processed/owasp_chunks.jsonl');

let owaspChunks = [];
let isLoaded = false;

// Tokenize text into normalized lower-case word stems
const tokenize = (text) => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
};

// Load OWASP chunks into memory on startup
export const loadOWASPKnowledge = () => {
  if (isLoaded) return owaspChunks.length;

  try {
    if (!fs.existsSync(CHUNKS_FILE_PATH)) {
      console.warn(`[OWASP Search] Knowledge file not found at ${CHUNKS_FILE_PATH}. Run python script to generate.`);
      return 0;
    }

    console.log('[OWASP Search] Indexing OWASP Knowledge Base in memory...');
    const startTime = Date.now();
    const fileData = fs.readFileSync(CHUNKS_FILE_PATH, 'utf-8');
    const lines = fileData.split('\n');

    owaspChunks = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        const tokens = tokenize(`${item.source} ${item.document_type} ${item.text}`);
        owaspChunks.push({
          ...item,
          tokens
        });
      } catch (e) {
        // Ignore malformed line
      }
    }

    isLoaded = true;
    const duration = Date.now() - startTime;
    console.log(`[OWASP Search] Successfully indexed ${owaspChunks.length} OWASP chunks in ${duration}ms.`);
    return owaspChunks.length;
  } catch (error) {
    console.error('[OWASP Search] Failed to load OWASP knowledge base:', error.message);
    return 0;
  }
};

// Perform high-speed TF-IDF / BM25 term frequency search across OWASP chunks
export const searchOWASP = (query, limit = 3) => {
  if (!isLoaded || owaspChunks.length === 0) {
    loadOWASPKnowledge();
  }

  if (!query || typeof query !== 'string' || owaspChunks.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scores = [];

  for (let i = 0; i < owaspChunks.length; i++) {
    const chunk = owaspChunks[i];
    let score = 0;

    // Check token matches
    for (const qToken of queryTokens) {
      // Direct token match in text
      const matches = chunk.tokens.filter(t => t === qToken).length;
      if (matches > 0) {
        score += matches * 1.5;
      }
      // Substring match in source title or text
      if (chunk.source.toLowerCase().includes(qToken)) {
        score += 5; // Title match boost
      }
    }

    if (score > 0) {
      scores.push({
        source: chunk.source,
        framework: chunk.framework,
        category: chunk.category,
        document_type: chunk.document_type,
        text: chunk.text,
        score
      });
    }
  }

  // Sort descending by score and take top matches
  scores.sort((a, b) => b.score - a.score);
  const results = scores.slice(0, limit);

  const searchDuration = Date.now() - startTime;
  console.log(`[OWASP Search] Query "${query.substring(0, 30)}..." matched ${results.length} chunks in ${searchDuration}ms.`);

  return results;
};

// Initial load call
loadOWASPKnowledge();
