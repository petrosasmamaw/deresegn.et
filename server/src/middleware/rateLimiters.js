import rateLimit from 'express-rate-limit';
import { makeRateLimitStore } from '../config/rateLimitStore.js';

/** Shared IP key (Render / proxies). */
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

/** Login / register / password — stop credential stuffing & bonus farming. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many auth attempts. Wait 15 minutes and try again.'),
});

/** Stricter cap on sign-up only (mounted before Better Auth when possible). */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many new accounts from this network. Try again later.'),
  skip: (req) => !/sign-up|signup|register/i.test(req.path + (req.originalUrl || '')),
});

/** Receipt verify / SMS / reference — protect Gemini + bank upstream cost. */
export const verifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req)}:${req.userId || 'anon'}`,
  store: makeRateLimitStore(),
  handler: limitJson('Too many verifications. Slow down and try again shortly.'),
});

/** Top-up submissions. */
export const topUpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(req)}:${req.userId || 'anon'}`,
  store: makeRateLimitStore(),
  handler: limitJson('Too many top-up attempts. Wait and try again.'),
});

/** Paid external API. */
export const apiV1RateLimiter = rateLimit({
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

/** General API burst shield. */
export const globalApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  store: makeRateLimitStore(),
  handler: limitJson('Too many requests. Please slow down.'),
});
