/**
 * Offline regression checks for chat RAG + session helpers (no Gemini cost).
 * Run: node scripts/chat-eval.js
 */

const assert = require('assert');
const { retrieveContext } = require('../services/chatRagService');
const { isValidSessionId, newSessionId } = require('../services/chatSessionService');

function testRag() {
  const r1 = retrieveContext('how do I track my order');
  assert(r1.context && r1.context.length > 10, 'RAG should return context for order FAQ');
  assert(r1.chunkIds.length > 0, 'RAG should return chunk ids');

  const r2 = retrieveContext('return policy refund');
  assert(/return|refund|14/i.test(r2.context), 'RAG should surface returns policy');

  const r3 = retrieveContext('xyzabc123nonexistent');
  assert(r3.context.length > 0, 'RAG should fallback to FAQ when no token match');

  console.log('✓ RAG retrieval tests passed');
}

function testSessionIds() {
  const id = newSessionId();
  assert(isValidSessionId(id), 'newSessionId should be valid UUID');
  assert(!isValidSessionId('not-a-uuid'), 'invalid id rejected');
  console.log('✓ Session id tests passed');
}

try {
  testRag();
  testSessionIds();
  console.log('\nchat-eval: all checks passed.');
  process.exit(0);
} catch (e) {
  console.error('\nchat-eval FAILED:', e.message);
  process.exit(1);
}
