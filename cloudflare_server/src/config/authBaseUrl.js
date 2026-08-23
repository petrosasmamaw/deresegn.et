/** Public Better Auth URL — must match the URL the browser uses for /api/auth. */
function normalizeAuthUrl(value) {
  let configured = (value || '').trim().replace(/\/+$/, '');
  if (!configured) return '';
  if (!/^https?:\/\//i.test(configured)) {
    configured = `https://${configured}`;
  }
  return configured;
}

export function resolveAuthBaseUrl() {
  let configured = normalizeAuthUrl(process.env.BETTER_AUTH_URL);
  const workerUrl = (process.env.WORKER_URL || process.env.CF_PAGES_URL || '').trim().replace(/\/+$/, '');
  const isProduction = process.env.NODE_ENV === 'production';

  if (configured) {
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

  if (/\.workers\.dev$/i.test(authHost)) return true;

  const candidates = [
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

  if (candidates.includes(authOrigin)) return false;
  if (authHost === 'tamagncheck.online' || authHost.endsWith('.tamagncheck.online')) return false;

  return candidates.some((origin) => origin !== authOrigin);
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
