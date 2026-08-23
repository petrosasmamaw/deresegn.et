/** Public Better Auth URL — must match the URL the browser uses for /api/auth. */
export function resolveAuthBaseUrl() {
  let configured = (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  const workerUrl = (process.env.WORKER_URL || process.env.CF_PAGES_URL || '').trim().replace(/\/+$/, '');
  const isProduction = process.env.NODE_ENV === 'production';

  if (configured) {
    // Common mistake: http:// site URL while the live site is https://
    if (isProduction && configured.startsWith('http://tamagncheck.online')) {
      configured = configured.replace('http://', 'https://');
    }
    if (isProduction && configured.startsWith('http://www.tamagncheck.online')) {
      configured = configured.replace('http://', 'https://');
    }
    return configured;
  }

  if (workerUrl) {
    return `${workerUrl}/api/auth`;
  }

  if (isProduction) {
    console.warn('⚠️  BETTER_AUTH_URL not set — using localhost fallback.');
  }
  return 'http://localhost:8787/api/auth';
}

function collectClientOrigins() {
  return [
    ...(process.env.CLIENT_URL || '').split(','),
    ...(process.env.CLIENT_URLS || '').split(','),
    'https://tamagncheck.online',
    'https://www.tamagncheck.online',
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * True when the browser must treat auth cookies as third-party
 * (API host ≠ website host). Same-origin Vercel /api rewrite → false.
 */
export function isCrossOriginAuth() {
  const authUrl = resolveAuthBaseUrl();
  if (!authUrl) return false;

  let authOrigin;
  let authHost;
  try {
    const u = new URL(authUrl);
    authOrigin = u.origin;
    authHost = u.hostname;
  } catch {
    return false;
  }

  // Direct workers.dev API is always cross-origin to the marketing site.
  if (/\.workers\.dev$/i.test(authHost)) return true;

  const clientOrigins = collectClientOrigins();
  // Same-origin (or www ↔ apex on same registrable site via rewrite) → first-party cookies.
  if (clientOrigins.includes(authOrigin)) return false;

  // Auth on apex while CLIENT_URL lists www (or vice versa) still first-party via proxy.
  const authIsSite =
    authHost === 'tamagncheck.online' || authHost.endsWith('.tamagncheck.online');
  if (authIsSite) return false;

  return clientOrigins.some((origin) => origin !== authOrigin);
}

export function getAuthCookieAttributes(isProduction) {
  const crossOrigin = isCrossOriginAuth();
  return {
    httpOnly: true,
    secure: isProduction || crossOrigin,
    sameSite: crossOrigin ? 'none' : 'lax',
    // Partitioned only for real third-party (workers.dev) cookies — CHIPS.
    ...(crossOrigin ? { partitioned: true } : {}),
    path: '/',
  };
}
