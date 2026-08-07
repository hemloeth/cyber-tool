import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_FILE_PATH = path.resolve(__dirname, '../knowledge/feedback/learned_rules.json');

/**
 * Loads learned rules from JSON file and formats them for the LLM system prompt.
 */
export const getLearnedRulesFormatted = () => {
  try {
    if (!fs.existsSync(RULES_FILE_PATH)) {
      return '';
    }

    const data = JSON.parse(fs.readFileSync(RULES_FILE_PATH, 'utf-8'));
    const rules = data.learnedRules || [];

    if (rules.length === 0) return '';

    return '\n\nLESSONS LEARNED FROM PAST CORRECTIONS & FEEDBACK:\n' +
      rules.map((r, idx) => `${idx + 1}. [${r.category}] ${r.rule}`).join('\n');

  } catch (error) {
    console.error('[FeedbackService] Error reading learned rules:', error.message);
    return '';
  }
};

/**
 * Appends a new learned rule from user corrections.
 */
export const addLearnedRule = (ruleText, category = 'General Correction') => {
  try {
    let data = { version: '1.0.0', updatedAt: new Date().toISOString(), learnedRules: [] };

    if (fs.existsSync(RULES_FILE_PATH)) {
      data = JSON.parse(fs.readFileSync(RULES_FILE_PATH, 'utf-8'));
    }

    const newRule = {
      id: `RULE-${String(data.learnedRules.length + 1).padStart(3, '0')}`,
      category,
      rule: ruleText,
      source: 'User Feedback'
    };

    data.learnedRules.push(newRule);
    data.updatedAt = new Date().toISOString();

    fs.mkdirSync(path.dirname(RULES_FILE_PATH), { recursive: true });
    fs.writeFileSync(RULES_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`[FeedbackService] Saved new learned rule: ${newRule.id}`);
    return newRule;
  } catch (error) {
    console.error('[FeedbackService] Error adding learned rule:', error.message);
    throw error;
  }
};
