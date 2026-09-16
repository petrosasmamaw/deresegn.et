import { getPrimaryClientOrigin } from '../config/clientOrigins.js';

function isOfficialMobile(c) {
  return (
    c.req.header('x-tamagn-client') === '1' &&
    String(c.req.header('x-tamagn-platform') || '').toLowerCase() === 'mobile'
  );
}

function isBadNativeOrigin(origin) {
  if (!origin) return true;
  if (origin === 'null') return true;
  if (/^exp:\/\//i.test(origin)) return true;
  return false;
}

/**
 * Installed Expo apps send Origin: null — Better Auth rejects that.
 * Official mobile clients are identified by X-Tamagn-* headers.
 */
export async function normalizeNativeClientOrigin(c, next) {
  if (!isOfficialMobile(c)) return next();
  const origin = c.req.header('origin');
  if (!isBadNativeOrigin(origin)) return next();

  const primary = getPrimaryClientOrigin();
  if (primary) {
    c.req.raw.headers.set('origin', primary);
    if (!c.req.header('referer') && !c.req.header('referrer')) {
      c.req.raw.headers.set('referer', `${primary}/`);
    }
  }
  await next();
}
