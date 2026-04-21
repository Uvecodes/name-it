/**
 * In-process chat metrics (reset on deploy). For Prometheus, export via /api/chat/metrics JSON.
 */

const metrics = {
  requests: 0,
  successes: 0,
  errors: 0,
  rateLimited: 0,
  timeouts: 0,
  geminiErrors: 0,
  sessionCreated: 0,
  latencyMsSum: 0,
  latencyMsMax: 0,
  startedAt: Date.now(),
};

function recordRequest({ success, errorType, latencyMs, rateLimited, sessionCreated }) {
  metrics.requests += 1;
  if (rateLimited) metrics.rateLimited += 1;
  if (sessionCreated) metrics.sessionCreated += 1;
  if (typeof latencyMs === 'number') {
    metrics.latencyMsSum += latencyMs;
    metrics.latencyMsMax = Math.max(metrics.latencyMsMax, latencyMs);
  }
  if (success) {
    metrics.successes += 1;
    return;
  }
  if (errorType === 'ratelimit') {
    return;
  }
  metrics.errors += 1;
  if (errorType === 'timeout') metrics.timeouts += 1;
  if (errorType === 'gemini') metrics.geminiErrors += 1;
}

function getSnapshot() {
  const uptimeSec = Math.floor((Date.now() - metrics.startedAt) / 1000);
  const avgLatency = metrics.requests > 0 ? Math.round(metrics.latencyMsSum / metrics.requests) : 0;
  return {
    uptimeSec,
    requests: metrics.requests,
    successes: metrics.successes,
    errors: metrics.errors,
    rateLimited: metrics.rateLimited,
    timeouts: metrics.timeouts,
    geminiErrors: metrics.geminiErrors,
    sessionCreated: metrics.sessionCreated,
    avgLatencyMs: avgLatency,
    maxLatencyMs: metrics.latencyMsMax,
    successRate: metrics.requests > 0 ? Number((metrics.successes / metrics.requests).toFixed(4)) : 0,
  };
}

module.exports = {
  recordRequest,
  getSnapshot,
};
