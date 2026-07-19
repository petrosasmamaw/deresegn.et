const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://deresegn-et.vercel.app',
  'https://check-deresegn-et.vercel.app',
  // Yegara / cPanel production
  'http://tamagncheck.pro.et',
  'https://tamagncheck.pro.et',
  'http://www.tamagncheck.pro.et',
  'https://www.tamagncheck.pro.et',
];

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    return u.origin; // scheme + host + port only
  } catch {
    return url.trim().replace(/\/+$/, '') || null;
  }
}

/** Split CLIENT_URL / CLIENT_URLS — either may be comma-separated. */
function originsFromEnvValue(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Origins allowed for CORS and Better Auth (cookies / sign-in from the client). */
export function getTrustedOrigins() {
  const fromEnv = [
    ...originsFromEnvValue(process.env.CLIENT_URL),
    ...originsFromEnvValue(process.env.CLIENT_URLS),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

export function isTrustedOrigin(origin) {
  if (!origin) return true;
  return getTrustedOrigins().includes(normalizeOrigin(origin));
}

/** First configured client origin (for cookie / logging helpers). */
export function getPrimaryClientOrigin() {
  const list = getTrustedOrigins().filter((o) => !o.includes('localhost'));
  return list[0] || getTrustedOrigins()[0] || null;
}
