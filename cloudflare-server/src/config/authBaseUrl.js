import { getTrustedOrigins } from './clientOrigins.js';

/**
 * Public Better Auth URL — resolves from BETTER_AUTH_URL env.
 * Works on both Render (RENDER_EXTERNAL_URL fallback) and Cloudflare Workers.
 */
export function resolveAuthBaseUrl() {
  let configured = (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  const renderBase = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  const isProduction = process.env.NODE_ENV === 'production';

  // Common misconfig: BETTER_AUTH_URL still points at Vercel after removing vercel.json proxy.
  if (isProduction && configured && renderBase) {
    try {
      const authHost = new URL(configured).hostname;
      if (authHost.includes('vercel.app')) {
        configured = `${renderBase}/api/auth`;
        console.warn(
          '⚠️  BETTER_AUTH_URL was pointing at Vercel — auto-corrected to:',
          configured,
        );
      }
    } catch {
      // keep configured
    }
  }

  if (configured) {
    if (!configured.endsWith('/api/auth')) {
      configured = `${configured}/api/auth`;
    }
    return configured;
  }

  if (isProduction && renderBase) {
    return `${renderBase}/api/auth`;
  }

  if (isProduction) {
    return 'https://deresegn-cloudflare-server.asmamawpetros.workers.dev/api/auth';
  }
  return 'http://localhost:5000/api/auth';
}

/**
 * Returns true when the API origin differs from ANY production frontend origin.
 * This means cross-origin cookies (SameSite=None) are required.
 */
export function isCrossOriginAuth() {
  const authUrl = resolveAuthBaseUrl();
  if (!authUrl) return false;

  let authOrigin;
  try {
    authOrigin = new URL(authUrl).origin;
  } catch {
    return false;
  }

  // Check if any non-localhost trusted origin is on a different host
  const productionOrigins = getTrustedOrigins().filter(
    (o) => !/(localhost|127\.0\.0\.1|::1)/i.test(o),
  );

  // If we have production origins and the auth URL is on a different origin → cross-origin
  for (const origin of productionOrigins) {
    try {
      if (new URL(origin).origin !== authOrigin) return true;
    } catch {
      if (origin !== authOrigin) return true;
    }
  }

  if (authOrigin && authOrigin.includes('workers.dev')) {
    return true;
  }

  return false;
}

export function getAuthCookieAttributes(isProduction) {
  const crossOrigin = isProduction && isCrossOriginAuth();
  if (crossOrigin) {
    console.log('🍪 Cross-origin auth detected — using SameSite=None + Partitioned');
  }
  return {
    httpOnly: true,
    secure: isProduction || crossOrigin,
    // Cross-origin SPA↔API needs None; same-site can use Lax (stronger CSRF default).
    sameSite: crossOrigin ? 'none' : 'lax',
    ...(crossOrigin ? { partitioned: true } : {}),
    path: '/',
  };
}

