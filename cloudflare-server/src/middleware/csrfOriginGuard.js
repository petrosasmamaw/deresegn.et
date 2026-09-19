import { isTrustedOrigin } from '../config/clientOrigins.js';

/**
 * CSRF defense for cookie-authenticated browser calls.
 * Cross-site form posts cannot set custom headers; trusted SPA always sends Origin + X-Tamagn-Client.
 * API-key traffic is skipped (no session cookies required).
 * Native mobile clients send custom headers + session cookie.
 */
export async function csrfOriginGuard(c, next) {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const apiKey = c.req.header('x-api-key');
  const authHeader = c.req.header('authorization') || '';
  if (apiKey || authHeader.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  // Official mobile app (custom headers cannot be forged by cross-site forms)
  const isMobileClient =
    c.req.header('x-tamagn-client') === '1' &&
    String(c.req.header('x-tamagn-platform') || '').toLowerCase() === 'mobile';
  if (isMobileClient) {
    return next();
  }

  const origin = c.req.header('origin');
  if (origin && /^exp:\/\//i.test(origin)) {
    return next();
  }
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }

  const referer = c.req.header('referer') || c.req.header('referrer');
  if (referer) {
    try {
      if (isTrustedOrigin(new URL(referer).origin)) {
        return next();
      }
    } catch {
      // ignore
    }
  }

  // Dev convenience: same-machine tools without Origin
  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    return next();
  }

  console.warn('[CSRF] blocked', method, c.req.path, 'origin=', origin || '-', 'referer=', referer || '-');
  return c.json(
    {
      success: false,
      message: 'Request blocked (invalid origin). Use the official Tamagn Check website.',
      code: 'CSRF_BLOCKED',
    },
    403,
  );
}
