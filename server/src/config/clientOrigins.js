const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://deresegn-et.vercel.app',
];

function normalizeOrigin(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/\/+$/, '');
}

/** Origins allowed for CORS and Better Auth (cookies / sign-in from the client). */
export function getTrustedOrigins() {
  const fromEnv = [
    process.env.CLIENT_URL,
    ...(process.env.CLIENT_URLS || '').split(','),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

export function isTrustedOrigin(origin) {
  if (!origin) return true;
  return getTrustedOrigins().includes(normalizeOrigin(origin));
}
