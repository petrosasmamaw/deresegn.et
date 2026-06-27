/** Public Better Auth URL — the Render API URL in production. */
export function resolveAuthBaseUrl() {
  const configured = (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.warn('⚠️  BETTER_AUTH_URL not set — using localhost fallback (set in Render env).');
  }
  return 'http://localhost:5000/api/auth';
}

/** Vercel frontend + Render API = cross-origin cookies (SameSite=None). */
export function isCrossOriginAuth() {
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  const authUrl = resolveAuthBaseUrl();
  if (!clientUrl || !authUrl) return false;
  try {
    return new URL(clientUrl).origin !== new URL(authUrl).origin;
  } catch {
    return false;
  }
}
