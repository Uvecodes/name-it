const crypto = require('crypto');

function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const rid = typeof incoming === 'string' && incoming.length <= 128
    ? incoming
    : crypto.randomUUID();
  req.requestId = rid;
  res.setHeader('x-request-id', rid);
  next();
}

function basicSecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function safeErrorResponse(res, status, code, userMessage, requestId) {
  return res.status(status).json({
    error: code,
    message: userMessage,
    requestId,
  });
}

function safeErrorLog(prefix, req, error) {
  const msg = error && error.message ? String(error.message) : 'unknown_error';
  console.error(`[${prefix}] requestId=${req?.requestId || 'n/a'} message=${msg}`);
}

module.exports = {
  requestId,
  basicSecurityHeaders,
  safeErrorResponse,
  safeErrorLog,
};

