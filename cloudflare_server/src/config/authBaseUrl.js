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

/** Frontend ↔ API on different hosts → need SameSite=None cookies. */
export function isCrossOriginAuth() {
  const authUrl = resolveAuthBaseUrl();
  if (!authUrl) return false;

  let authOrigin;
  try {
    authOrigin = new URL(authUrl).origin;
  } catch {
    return false;
  }

  const candidates = [
    ...(process.env.CLIENT_URL || '').split(','),
    ...(process.env.CLIENT_URLS || '').split(','),
    'https://tamagncheck.online',
    'https://www.tamagncheck.online',
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of candidates) {
    try {
      const clientOrigin = new URL(entry).origin;
      if (clientOrigin !== authOrigin) return true;
    } catch {
      // ignore invalid entry
    }
  }

  // workers.dev API is always cross-origin to the website
  if (/\.workers\.dev$/i.test(new URL(authUrl).hostname)) return true;

  return false;
}

export function getAuthCookieAttributes(isProduction) {
  const crossOrigin = isCrossOriginAuth();
  return {
    httpOnly: true,
    secure: isProduction || crossOrigin,
    sameSite: crossOrigin ? 'none' : 'lax',
    ...(crossOrigin ? { partitioned: true } : {}),
    path: '/',
  };
}
