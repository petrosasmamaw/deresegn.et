/** Public Better Auth URL — same-origin on Vercel; Render URL when API is separate. */
export function resolveAuthBaseUrl() {
  let configured = (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  const renderBase = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  const isProduction = process.env.NODE_ENV === 'production';
  const onVercel = Boolean(process.env.VERCEL);

  // Combined Vercel deploy: prefer configured URL, else VERCEL_URL.
  if (onVercel) {
    if (configured) return configured;
    const vercelHost = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
    if (vercelHost) {
      const host = vercelHost.startsWith('http') ? vercelHost : `https://${vercelHost}`;
      return `${host.replace(/\/+$/, '')}/api/auth`;
    }
  }

  // Common misconfig: BETTER_AUTH_URL still points at Vercel after removing vercel.json proxy
  // (only when API is on Render, not when this app is the Vercel deploy).
  if (isProduction && !onVercel && configured && renderBase) {
    try {
      const authHost = new URL(configured).hostname;
      if (authHost.includes('vercel.app')) {
        configured = `${renderBase}/api/auth`;
        console.warn(
          '⚠️  BETTER_AUTH_URL was pointing at Vercel — auto-corrected to:',
          configured,
          '\n   Set BETTER_AUTH_URL to this value in Render env and redeploy.',
        );
      }
    } catch {
      // keep configured
    }
  }

  if (configured) return configured;

  if (isProduction && renderBase) {
    return `${renderBase}/api/auth`;
  }

  if (isProduction) {
    console.warn('⚠️  BETTER_AUTH_URL not set — using localhost fallback (set in Render/Vercel env).');
  }
  return 'http://localhost:5000/api/auth';
}

/** Frontend(s) + Render API = cross-origin cookies (SameSite=None). */
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
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of candidates) {
    try {
      if (new URL(entry).origin !== authOrigin) return true;
    } catch {
      // ignore invalid entry
    }
  }

  return false;
}

export function getAuthCookieAttributes(isProduction) {
  const crossOrigin = isProduction && isCrossOriginAuth();
  return {
    httpOnly: true,
    secure: isProduction || crossOrigin,
    // Cross-origin SPA↔API needs None; same-site can use Lax (stronger CSRF default).
    sameSite: crossOrigin ? 'none' : 'lax',
    ...(crossOrigin ? { partitioned: true } : {}),
    path: '/',
  };
}
