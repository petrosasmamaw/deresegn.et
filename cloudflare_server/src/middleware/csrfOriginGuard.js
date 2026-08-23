import { isTrustedOrigin } from '../config/clientOrigins.js';

/**
 * CSRF defense for cookie-authenticated browser calls.
 * Cross-site form posts cannot set custom headers; trusted SPA always sends Origin + X-Tamagn-Client.
 * API-key traffic is skipped (no session cookies required).
 * Native mobile clients send custom headers (browser forms cannot) + session cookie.
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

  // Official mobile app (custom headers cannot be forged by cross-site forms)
  const isMobileClient =
    req.headers['x-tamagn-client'] === '1' &&
    String(req.headers['x-tamagn-platform'] || '').toLowerCase() === 'mobile';
  if (isMobileClient) {
    return next();
  }

  const origin = req.headers.origin;
  // Expo deep-link style origins are not browser SPA sites
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

  // Dev convenience: same-machine tools without Origin
  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    return next();
  }

  console.warn('[CSRF] blocked', method, req.originalUrl, 'origin=', origin || '-', 'referer=', referer || '-');
  return res.status(403).json({
    success: false,
    message: 'Request blocked (invalid origin). Use the official Tamagn Check website.',
    code: 'CSRF_BLOCKED',
  });
}
