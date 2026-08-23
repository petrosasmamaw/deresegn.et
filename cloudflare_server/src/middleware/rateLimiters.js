import rateLimit from 'express-rate-limit';
import { makeRateLimitStore } from '../config/rateLimitStore.js';
import { isWorkersRuntime } from '../config/runtime.js';

function ipKey(req) {
  return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
}

function limitJson(message) {
  return (_req, res) => {
    res.status(429).json({
      success: false,
      message,
      code: 'RATE_LIMITED',
    });
  };
}

/** Defer rateLimit() construction until first request (Workers forbid setInterval at global scope). */
function lazyRateLimit(options) {
  let limiter;
  return (req, res, next) => {
    if (!limiter) limiter = rateLimit(options);
    return limiter(req, res, next);
  };
}

function buildLimiter(options) {
  return isWorkersRuntime() ? lazyRateLimit(options) : rateLimit(options);
}

export const authRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many auth attempts. Wait 15 minutes and try again.'),
});

export const signupRateLimiter = buildLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many new accounts from this network. Try again later.'),
  skip: (req) => !/sign-up|signup|register/i.test(req.path + (req.originalUrl || '')),
});

export const verifyRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req)}:${req.userId || 'anon'}`,
  store: makeRateLimitStore(),
  handler: limitJson('Too many verifications. Slow down and try again shortly.'),
});

export const topUpRateLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req)}:${req.userId || 'anon'}`,
  store: makeRateLimitStore(),
  handler: limitJson('Too many top-up attempts. Wait and try again.'),
});

export const apiV1RateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const key = req.headers['x-api-key'] || req.headers.authorization || '';
    return `${ipKey(req)}:${String(key).slice(0, 24)}`;
  },
  store: makeRateLimitStore(),
  handler: limitJson('API rate limit exceeded. Wait a minute and retry.'),
});

export const globalApiRateLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many requests. Please slow down.'),
});
