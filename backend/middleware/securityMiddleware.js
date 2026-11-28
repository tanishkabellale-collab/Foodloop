/**
 * FoodLoop HTTP Security Headers & Lightweight Sliding-Window Rate Limiter
 */

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}

function createRateLimiter({ windowMs = 60000, maxRequests = 60, name = 'api' } = {}) {
  const hits = new Map();

  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const now = Date.now();
    const key = `${name}:${req.ip || req.socket?.remoteAddress || 'local'}`;
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      hits.set(key, entry);
      if (hits.size > 1000) {
        for (const [k, v] of hits.entries()) {
          if (v.resetAt <= now) hits.delete(k);
        }
      }
    } else {
      entry.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));

    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      });
    }

    return next();
  };
}

module.exports = {
  securityHeaders,
  createRateLimiter,
};
