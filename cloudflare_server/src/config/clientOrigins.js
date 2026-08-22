/** Live website origins — always allowed for CORS / Better Auth. */
const PRODUCTION_ORIGINS = [
  'https://tamagncheck.online',
  'https://www.tamagncheck.online',
];

/** Local Vite only. */
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    return u.origin;
  } catch {
    return url.trim().replace(/\/+$/, '') || null;
  }
}

function originsFromEnvValue(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function isLocalDevOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

function isProductionEnv() {
  // Prefer runtime Worker binding; fall back to build-time define.
  const fromBinding = globalThis.__WORKER_ENV?.NODE_ENV;
  const value = String(fromBinding || process.env.NODE_ENV || '').toLowerCase();
  return value === 'production';
}

/**
 * Origins allowed for CORS and Better Auth.
 * Always includes production website origins so Workers CORS cannot
 * accidentally drop tamagncheck.online when NODE_ENV is wrong.
 */
export function getTrustedOrigins() {
  const isProduction = isProductionEnv();
  const defaults = isProduction
    ? [...PRODUCTION_ORIGINS]
    : [...DEV_ORIGINS, ...PRODUCTION_ORIGINS];

  const fromEnv = [
    ...originsFromEnvValue(process.env.CLIENT_URL || globalThis.__WORKER_ENV?.CLIENT_URL),
    ...originsFromEnvValue(process.env.CLIENT_URLS || globalThis.__WORKER_ENV?.CLIENT_URLS),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter((origin) => !(isProduction && isLocalDevOrigin(origin)));

  // Always keep https site origins even if CLIENT_URL was set to http:// by mistake.
  return [...new Set([...defaults, ...PRODUCTION_ORIGINS, ...fromEnv])];
}

export function isTrustedOrigin(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (getTrustedOrigins().includes(normalized)) return true;
  // Allow any *.tamagncheck.online subdomain over https
  try {
    const host = new URL(normalized).hostname;
    if (normalized.startsWith('https://') && (host === 'tamagncheck.online' || host.endsWith('.tamagncheck.online'))) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function getPrimaryClientOrigin() {
  const list = getTrustedOrigins().filter((o) => !isLocalDevOrigin(o));
  return list[0] || getTrustedOrigins()[0] || null;
}
