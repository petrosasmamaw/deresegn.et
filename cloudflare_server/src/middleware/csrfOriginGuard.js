import { isTrustedOrigin } from '../config/clientOrigins.js';

/**
 * Express-style CSRF guard (used via toHono).
 */
export function csrfOriginGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  const auth = req.headers.authorization || '';
  if (apiKey || auth.toLowerCase().startsWith('bearer dk_live_')) {
    return next();
  }

  const isMobileClient =
    req.headers['x-tamagn-client'] === '1' &&
    String(req.headers['x-tamagn-platform'] || '').toLowerCase() === 'mobile';
  if (isMobileClient) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin && /^exp:\/\//i.test(origin)) {
    return next();
  }
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }

  const referer = req.headers.referer || req.headers.referrer;
  if (referer) {
    try {
      if (isTrustedOrigin(new URL(referer).origin)) {
        return next();
      }
    } catch {
      // ignore
    }
  }

  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    return next();
  }

  // Same-origin Workers rewrite (no Origin) with custom client header
  if (req.headers['x-tamagn-client'] === '1' && !origin) {
    return next();
  }

  console.warn('[CSRF] blocked', method, req.originalUrl, 'origin=', origin || '-', 'referer=', referer || '-');
  return res.status(403).json({
    success: false,
    message: 'Request blocked (invalid origin). Use the official Tamagn Check website.',
    code: 'CSRF_BLOCKED',
  });
}

/** Hono middleware wrapper */
export async function csrfOriginGuardHono(c, next) {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    await next();
    return;
  }

  const apiKey = c.req.header('x-api-key');
  const auth = c.req.header('authorization') || '';
  if (apiKey || auth.toLowerCase().startsWith('bearer dk_live_')) {
    await next();
    return;
  }

  const isMobileClient =
    c.req.header('x-tamagn-client') === '1' &&
    String(c.req.header('x-tamagn-platform') || '').toLowerCase() === 'mobile';
  if (isMobileClient) {
    await next();
    return;
  }

  const origin = c.req.header('origin');
  if (origin && /^exp:\/\//i.test(origin)) {
    await next();
    return;
  }
  if (origin && isTrustedOrigin(origin)) {
    await next();
    return;
  }

  const referer = c.req.header('referer') || c.req.header('referrer');
  if (referer) {
    try {
      if (isTrustedOrigin(new URL(referer).origin)) {
        await next();
        return;
      }
    } catch {
      // ignore
    }
  }

  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    await next();
    return;
  }

  if (c.req.header('x-tamagn-client') === '1' && !origin) {
    await next();
    return;
  }

  console.warn('[CSRF] blocked', method, c.req.path, 'origin=', origin || '-');
  return c.json(
    {
      success: false,
      message: 'Request blocked (invalid origin). Use the official Tamagn Check website.',
      code: 'CSRF_BLOCKED',
    },
    403,
  );
}
