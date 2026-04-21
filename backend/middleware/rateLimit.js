/**
 * Lightweight in-process rate limiter (good baseline; swap with Redis for multi-instance).
 */

const buckets = new Map();

function ipFromReq(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function makeLimiter({ windowMs, max, keyFn }) {
  return function limiter(req, res, next) {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : ipFromReq(req);
    const bucketKey = `${req.path}:${key}`;
    let state = buckets.get(bucketKey);
    if (!state || now > state.resetAt) {
      state = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, state);
    }
    state.count += 1;
    const remaining = Math.max(0, max - state.count);
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil((state.resetAt - now) / 1000)));
    if (state.count > max) {
      return res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many requests, please try again later.',
      });
    }
    next();
  };
}

const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

const strictAuthLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyFn: (req) => `${ipFromReq(req)}:${String(req.body?.email || '').toLowerCase()}`,
});

const writeLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
});

module.exports = {
  makeLimiter,
  authLimiter,
  strictAuthLimiter,
  writeLimiter,
  ipFromReq,
};

