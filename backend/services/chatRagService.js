/**
 * Lightweight RAG: retrieve policy/FAQ/playbook chunks by keyword overlap (no vector DB required).
 */

const { businessContext } = require('../config/businessContext');
const { marketingPlaybook, getPlaybookPrompt } = require('../config/marketingPlaybook');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreChunk(queryTokens, chunkText) {
  const chunkTokens = new Set(tokenize(chunkText));
  if (chunkTokens.size === 0) return 0;
  let score = 0;
  for (const t of queryTokens) {
    if (chunkTokens.has(t)) score += 1;
  }
  return score;
}

function buildChunks() {
  const chunks = [];

  for (const faq of businessContext.faq || []) {
    chunks.push({
      id: `faq:${faq.question}`,
      text: `Q: ${faq.question}\nA: ${faq.answer}`,
    });
  }

  chunks.push({
    id: 'policy:shipping',
    text: `Shipping policy: ${JSON.stringify(businessContext.policies.shipping)}`,
  });
  chunks.push({
    id: 'policy:returns',
    text: `Returns: ${JSON.stringify(businessContext.policies.returns)}`,
  });
  chunks.push({
    id: 'policy:payment',
    text: `Payment: ${JSON.stringify(businessContext.policies.payment)}`,
  });
  chunks.push({
    id: 'rewards',
    text: `Rewards: ${JSON.stringify(businessContext.rewards)}`,
  });
  chunks.push({
    id: 'navigation',
    text: `Site map: ${JSON.stringify(businessContext.navigation)}`,
  });

  const playbookStr = getPlaybookPrompt();
  if (playbookStr && playbookStr.length < 12000) {
    chunks.push({ id: 'playbook', text: playbookStr.slice(0, 8000) });
  } else {
    chunks.push({
      id: 'playbook:short',
      text: 'Sales guidance: be helpful, not pushy; acknowledge objections; suggest complementary items when relevant.',
    });
  }

  if (marketingPlaybook?.objectionHandling?.framework) {
    chunks.push({
      id: 'objections',
      text: `Objection handling: ${marketingPlaybook.objectionHandling.framework}`,
    });
  }

  return chunks;
}

const CACHED_CHUNKS = buildChunks();

/**
 * @param {string} userMessage
 * @param {number} topK
 * @returns {{ context: string, chunkIds: string[] }}
 */
function retrieveContext(userMessage, topK = 4) {
  const queryTokens = tokenize(userMessage);
  if (queryTokens.length === 0) {
    return { context: '', chunkIds: [] };
  }

  const scored = CACHED_CHUNKS.map((c) => ({
    ...c,
    score: scoreChunk(queryTokens, c.text) + (c.id.startsWith('faq') ? 0.5 : 0),
  }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (scored.length === 0) {
    const fallback = CACHED_CHUNKS.filter((c) => c.id.startsWith('faq')).slice(0, 2);
    const context = fallback.map((c) => `[${c.id}]\n${c.text}`).join('\n\n---\n\n');
    return { context, chunkIds: fallback.map((c) => c.id) };
  }

  const context = scored.map((c) => `[${c.id}]\n${c.text}`).join('\n\n---\n\n');
  return { context, chunkIds: scored.map((c) => c.id) };
}

module.exports = {
  retrieveContext,
  tokenize,
};
