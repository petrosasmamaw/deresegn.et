const isProduction = process.env.NODE_ENV === 'production';

/** Live site only — used on Render / deployed API. */
const PRODUCTION_ORIGINS = [
  'https://tamagncheck.online',
  'https://www.tamagncheck.online',
];

/** Local Vite only — never trusted by the deployed server. */
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

/**
 * Origins allowed for CORS and Better Auth.
 * Deployed (production): only your domain (+ CLIENT_URL), never localhost.
 * Local (development): localhost Vite + any CLIENT_URL.
 */
export function getTrustedOrigins() {
  const defaults = isProduction ? PRODUCTION_ORIGINS : [...DEV_ORIGINS, ...PRODUCTION_ORIGINS];

  const fromEnv = [
    ...originsFromEnvValue(process.env.CLIENT_URL),
    ...originsFromEnvValue(process.env.CLIENT_URLS),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
    // Hard block: production must never trust a browser on someone's PC
    .filter((origin) => !(isProduction && isLocalDevOrigin(origin)));

  return [...new Set([...defaults, ...fromEnv])];
}

export function isTrustedOrigin(origin) {
  if (!origin) return true; // non-browser / same-origin tools (curl, health checks)
  return getTrustedOrigins().includes(normalizeOrigin(origin));
}

export function getPrimaryClientOrigin() {
  const list = getTrustedOrigins().filter((o) => !isLocalDevOrigin(o));
  return list[0] || getTrustedOrigins()[0] || null;
}
