/**
 * Edge-compatible rate limiters for Cloudflare Workers.
 */
function ipKey(c) {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function makeRateLimiter({ windowMs, max, message, keyGenerator, skip }) {
  const store = new Map();

  let lastCleanup = Date.now();

  return async (c, next) => {
    if (skip && skip(c)) {
      return next();
    }

    const now = Date.now();
    if (now - lastCleanup > 60000) {
      lastCleanup = now;
      for (const [k, e] of store.entries()) {
        if (now > e.resetTime) store.delete(k);
      }
    }

    const key = keyGenerator ? keyGenerator(c) : ipKey(c);
    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
    }

    entry.count += 1;
    store.set(key, entry);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > max) {
      return c.json(
        {
          success: false,
          message,
          code: 'RATE_LIMITED',
        },
        429,
      );
    }

    await next();
  };
}

/** Login / register / password — stop credential stuffing & bonus farming. */
export const authRateLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: ipKey,
  message: 'Too many auth attempts. Wait 15 minutes and try again.',
});

/** Stricter cap on sign-up only. */
export const signupRateLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
  keyGenerator: ipKey,
  skip: (c) => !/sign-up|signup|register/i.test(c.req.path),
  message: 'Too many new accounts from this network. Try again later.',
});

/** Receipt verify / SMS / reference — protect Gemini + bank upstream cost. */
export const verifyRateLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (c) => `${ipKey(c)}:${c.get('userId') || 'anon'}`,
  message: 'Too many verifications. Slow down and try again shortly.',
});

/** Top-up submissions. */
export const topUpRateLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: (c) => `${ipKey(c)}:${c.get('userId') || 'anon'}`,
  message: 'Too many top-up attempts. Wait and try again.',
});

/** Paid external API. */
export const apiV1RateLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (c) => {
    const key = c.req.header('x-api-key') || c.req.header('authorization') || '';
    return `${ipKey(c)}:${String(key).slice(0, 24)}`;
  },
  message: 'API rate limit exceeded. Wait a minute and retry.',
});

/** General API burst shield. */
export const globalApiRateLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: ipKey,
  message: 'Too many requests. Please slow down.',
});
