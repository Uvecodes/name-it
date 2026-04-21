/**
 * Chat Routes — production: server sessions, RAG, tools, Redis/memory rate limits, metrics.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const chatService = require('../services/chatService');
const chatRateLimitService = require('../services/chatRateLimitService');
const chatMetricsService = require('../services/chatMetricsService');
const chatSessionService = require('../services/chatSessionService');
const { optionalAuth } = require('../middleware/auth');
const { safeErrorLog } = require('../middleware/security');

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * GET /api/chat/metrics — protected by x-chat-metrics-key (omit in prod or rotate secret)
 */
router.get('/metrics', (req, res) => {
  const key = req.headers['x-chat-metrics-key'];
  if (!process.env.CHAT_METRICS_SECRET || key !== process.env.CHAT_METRICS_SECRET) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({
    ...chatMetricsService.getSnapshot(),
    rateLimit: chatRateLimitService.RATE_LIMIT,
  });
});

/**
 * POST /api/chat
 * Body: message (required), sessionId (optional UUID). conversationHistory from client is ignored.
 */
router.post(
  '/',
  optionalAuth,
  [
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('message').isLength({ max: 4000 }).withMessage('Message too long'),
    body('sessionId')
      .optional()
      .isUUID()
      .withMessage('Invalid session id'),
  ],
  async (req, res) => {
    const t0 = Date.now();
    let rateLimited = false;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: errors.array()[0].msg,
        });
      }

      const message = req.body.message.trim();
      const sessionId = req.body.sessionId || null;
      if (sessionId && !chatSessionService.isValidSessionId(sessionId)) {
        return res.status(400).json({ success: false, error: 'Invalid session id' });
      }

      const userId = req.user?.uid || null;
      const ip = clientIp(req);

      const rl = await chatRateLimitService.checkChatRateLimit(ip, userId);
      if (!rl.allowed) {
        rateLimited = true;
        chatMetricsService.recordRequest({
          success: false,
          errorType: 'ratelimit',
          latencyMs: Date.now() - t0,
          rateLimited: true,
          sessionCreated: false,
        });
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please wait a moment before sending another message.',
          retryAfter: Math.ceil(rl.resetIn / 1000),
        });
      }

      const result = await chatService.generateResponse(message, sessionId, userId);

      res.json({
        success: result.success,
        reply: result.reply,
        sessionId: result.sessionId,
        sessionCreated: !!result.sessionCreated,
        rateLimit: {
          remaining: rl.remaining,
          resetIn: Math.ceil(rl.resetIn / 1000),
        },
      });
    } catch (error) {
      safeErrorLog('chat.generate', req, error);
      chatMetricsService.recordRequest({
        success: false,
        errorType: 'server',
        latencyMs: Date.now() - t0,
        rateLimited,
        sessionCreated: false,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to generate response',
        reply:
          "I'm having trouble responding right now. Please try again or contact our customer service.",
      });
    }
  }
);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'TASH AI Chatbot',
    status: 'operational',
    features: ['server_sessions', 'rag', 'tools', 'rate_limit_redis_optional'],
  });
});

module.exports = router;
