/**
 * Distributed-friendly rate limiting for chat (Redis when REDIS_URL is set, else in-memory).
 */

const RATE_LIMIT = {
  maxRequests: parseInt(process.env.CHAT_RATE_LIMIT_MAX || '30', 10),
  windowMs: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS || '60000', 10),
};

let redisClient = null;
let redisConnectAttempted = false;

async function getRedis() {
  if (!process.env.REDIS_URL || redisConnectAttempted) {
    return redisClient;
  }
  redisConnectAttempted = true;
  try {
    const { createClient } = require('redis');
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => {
      console.error('Chat Redis error:', err.message);
    });
    await redisClient.connect();
    console.log('✅ Chat rate limit: using Redis');
    return redisClient;
  } catch (e) {
    console.warn('⚠️ Chat Redis unavailable, using in-memory rate limits:', e.message);
    redisClient = null;
    return null;
  }
}

const memoryStore = new Map();

function memoryCheck(key) {
  const now = Date.now();
  let entry = memoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
    memoryStore.set(key, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, RATE_LIMIT.maxRequests - entry.count);
  const resetIn = entry.resetTime - now;
  if (entry.count > RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetIn, backend: 'memory' };
  }
  return { allowed: true, remaining, resetIn, backend: 'memory' };
}

async function redisCheck(key) {
  const r = await getRedis();
  if (!r) {
    return memoryCheck(key);
  }
  const k = `chat:rl:${key}`;
  const n = await r.incr(k);
  if (n === 1) {
    await r.pExpire(k, RATE_LIMIT.windowMs);
  }
  const ttl = await r.pTTL(k);
  const resetIn = ttl > 0 ? ttl : RATE_LIMIT.windowMs;
  if (n > RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetIn, backend: 'redis' };
  }
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - n, resetIn, backend: 'redis' };
}

/**
 * Enforce rate limits for IP and optional user id (both must pass).
 */
async function checkChatRateLimit(ip, userId) {
  const ipKey = `ip:${ip || 'unknown'}`;
  const ipResult = await redisCheck(ipKey);
  if (!ipResult.allowed) {
    return { ...ipResult, limitedBy: 'ip' };
  }
  if (userId) {
    const userResult = await redisCheck(`uid:${userId}`);
    if (!userResult.allowed) {
      return { ...userResult, limitedBy: 'user' };
    }
    return {
      allowed: true,
      remaining: Math.min(ipResult.remaining, userResult.remaining),
      resetIn: Math.max(ipResult.resetIn, userResult.resetIn),
      backend: ipResult.backend,
    };
  }
  return { allowed: true, remaining: ipResult.remaining, resetIn: ipResult.resetIn, backend: ipResult.backend };
}

module.exports = {
  checkChatRateLimit,
  RATE_LIMIT,
};
