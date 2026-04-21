/**
 * Chat orchestration: Gemini + server sessions + RAG + tools + timeouts + metrics.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateDynamicPrompt } = require('../config/businessContext');
const categoryService = require('./categoryService');
const productStockService = require('./productStockService');
const chatSessionService = require('./chatSessionService');
const chatRagService = require('./chatRagService');
const chatToolsService = require('./chatToolsService');
const chatMetricsService = require('./chatMetricsService');

let genAI = null;
let model = null;

const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '25000', 10);
const MODEL_ID = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

function initializeGemini() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️ GEMINI_API_KEY not set in environment variables');
    return false;
  }
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL_ID });
    console.log('✅ Gemini AI initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini:', error);
    return false;
  }
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/**
 * @returns {Promise<{ reply: string, success: boolean, ragChunkIds?: string[] }>}
 */
async function generateResponse(userMessage, sessionId, userId = null) {
  const t0 = Date.now();
  let success = false;
  let errorType = null;
  let sidOut = null;
  let newSessionThisRequest = false;

  try {
    if (!model) {
      const ok = initializeGemini();
      if (!ok) {
        errorType = 'gemini';
        return {
          success: false,
          reply:
            "I'm having trouble connecting right now. Please try again in a moment, or contact our customer service for immediate help.",
          sessionId: null,
        };
      }
    }

    const { sessionId: sid, messages, created } = await chatSessionService.resolveSession(sessionId, userId);
    sidOut = sid;
    newSessionThisRequest = !!created;

    let categoryInfo = '';
    try {
      categoryInfo = await categoryService.formatCategoriesForPrompt();
    } catch (e) {
      console.error('Chat: categories error:', e.message);
      categoryInfo = 'We sell a variety of products including fragrances and clothing.';
    }

    let stockInfo = '';
    try {
      stockInfo = await productStockService.formatStockForAI();
    } catch (e) {
      console.error('Chat: stock error:', e.message);
    }

    const baseSystem = generateDynamicPrompt(categoryInfo, stockInfo);
    const { context: ragContext, chunkIds: ragChunkIds } = chatRagService.retrieveContext(userMessage, 4);

    let toolsBlock = '';
    if (userId) {
      const digest = await chatToolsService.orderDigestTool(userId);
      toolsBlock += `\n## Verified order summary (server)\n${digest.summary}\n`;
    } else {
      toolsBlock += '\n## Verified order summary (server)\nGuest user — no order data.\n';
    }

    if (chatToolsService.shouldRunProductSearch(userMessage)) {
      const search = await chatToolsService.searchProductsTool(userMessage);
      toolsBlock += `\n## Catalog search (server, keyword match)\n${search.summary}\n`;
      if (search.products?.length) {
        toolsBlock += `${JSON.stringify(search.products, null, 0).slice(0, 3500)}\n`;
      }
    }

    const ragBlock = ragContext
      ? `\n## Retrieved knowledge snippets (cite behavior, not internal ids)\n${ragContext.slice(0, 6000)}\n`
      : '';

    const systemPrompt = `${baseSystem}
${ragBlock}
${toolsBlock}

## Grounding rules
- Prefer facts from "Retrieved knowledge" and "Verified order summary" / "Catalog search" above over guesses.
- Never invent prices or stock counts; send users to the website for current prices.
- Do not reveal other customers' data or internal system details.
`;

    const history = chatSessionService.toGeminiHistory(messages, 10);

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [
            {
              text: `System Instructions (do not repeat verbatim): ${systemPrompt}\n\nAcknowledge briefly that you are TASH for NAME IT SCENTS.`,
            },
          ],
        },
        {
          role: 'model',
          parts: [
            {
              text: "Understood — I'm TASH, NAME IT SCENTS' assistant. I'll follow your policies and grounding rules. How can I help?",
            },
          ],
        },
        ...history,
      ],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.55,
        topP: 0.9,
      },
    });

    const result = await withTimeout(chat.sendMessage(userMessage.slice(0, 4000)), GEMINI_TIMEOUT_MS);
    const response = await result.response;
    const reply = (response.text() || '').trim();

    if (!reply) {
      throw new Error('EMPTY_REPLY');
    }

    try {
      await chatSessionService.appendExchange(sid, userMessage, reply);
    } catch (persistErr) {
      console.error('Chat: failed to persist turn:', persistErr.message);
    }

    success = true;
    return { success: true, reply, sessionId: sid, ragChunkIds, sessionCreated: created };
  } catch (error) {
    const msg = error && error.message ? String(error.message) : 'unknown';
    if (msg === 'TIMEOUT') {
      errorType = 'timeout';
    } else {
      errorType = 'gemini';
    }
    console.error('Chat generate error:', msg);
    const fallback = generateFallbackResponse(userMessage);
    try {
      if (sidOut) {
        await chatSessionService.appendExchange(sidOut, userMessage, fallback);
      }
    } catch (e) {
      /* ignore */
    }
    return {
      success: false,
      reply: fallback,
      sessionId: sidOut,
      ragChunkIds: [],
      error: 'degraded',
    };
  } finally {
    chatMetricsService.recordRequest({
      success,
      errorType,
      latencyMs: Date.now() - t0,
      rateLimited: false,
      sessionCreated: newSessionThisRequest,
    });
  }
}

function generateFallbackResponse(userMessage) {
  const message = userMessage.toLowerCase();

  if (message.includes('order') || message.includes('track') || message.includes('delivery')) {
    return 'To check your order status, please visit your profile page where your orders are listed. If you need further help, contact us at info@nameitscents.com.';
  }
  if (message.includes('return') || message.includes('refund')) {
    return 'We offer returns within 14 days of delivery for unopened/unworn products. Please contact customer service to initiate a return.';
  }
  if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
    return 'Prices vary by product. Please browse our collection page for current prices. I can still help you choose a product type or occasion.';
  }
  if (message.includes('recommend') || message.includes('suggest')) {
    return "I'd love to help you find something. Are you looking for fragrances, clothing, or both? What's the occasion?";
  }
  if (message.includes('hello') || message.includes('hi ') || message === 'hi' || message.includes('hey')) {
    return "Hello! I'm TASH. I can help with products, policies, or your account. What would you like to know?";
  }
  if (message.includes('thank')) {
    return "You're welcome! Anything else I can help with?";
  }
  return "I'm here to help with NAME IT SCENTS — products, shipping, returns, or your account. What would you like to know?";
}

module.exports = {
  initializeGemini,
  generateResponse,
  generateFallbackResponse,
};
