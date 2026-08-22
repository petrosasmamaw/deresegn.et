/**
 * Simple KV-backed rate limiter for Cloudflare Workers.
 * Falls back to in-memory Map when RATE_LIMIT_KV is unavailable (local tests).
 */
const memoryBuckets = new Map();

function clientKey(c) {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function makeLimiter({ windowMs, max, prefix }) {
  return async (c, next) => {
    const ip = clientKey(c);
    const bucketKey = `${prefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const kv = c.env?.RATE_LIMIT_KV;

    let timestamps = [];
    try {
      if (kv) {
        const raw = await kv.get(bucketKey);
        timestamps = raw ? JSON.parse(raw) : [];
      } else {
        timestamps = memoryBuckets.get(bucketKey) || [];
      }
    } catch {
      timestamps = [];
    }

    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length >= max) {
      return c.json(
        {
          success: false,
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
        },
        429,
      );
    }

    timestamps.push(now);
    try {
      if (kv) {
        await kv.put(bucketKey, JSON.stringify(timestamps), {
          expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)),
        });
      } else {
        memoryBuckets.set(bucketKey, timestamps);
      }
    } catch {
      // ignore store failures
    }

    await next();
  };
}

export const globalApiRateLimiter = makeLimiter({
  windowMs: 60_000,
  max: 120,
  prefix: 'global',
});

export const authRateLimiter = makeLimiter({
  windowMs: 60_000,
  max: 40,
  prefix: 'auth',
});

export const signupRateLimiter = makeLimiter({
  windowMs: 60 * 60_000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  prefix: 'signup',
});

export const verifyRateLimiter = makeLimiter({
  windowMs: 60_000,
  max: 30,
  prefix: 'verify',
});

export const topUpRateLimiter = makeLimiter({
  windowMs: 60_000,
  max: 20,
  prefix: 'topup',
});

export const apiV1RateLimiter = makeLimiter({
  windowMs: 60_000,
  max: 60,
  prefix: 'v1',
});
