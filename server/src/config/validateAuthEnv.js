/** Warn when production auth env is misconfigured. */
export function validateAuthEnv() {
  const authUrl = (process.env.BETTER_AUTH_URL || '').trim();
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) return;

  if (!authUrl) {
    console.error('❌ BETTER_AUTH_URL is missing.');
    return;
  }

  const authHost = hostFromUrl(authUrl);
  const clientHost = hostFromUrl(clientUrl);
  const renderHost = authHost.includes('onrender.com');
  const vercelClient = clientHost.includes('vercel.app');
  const vercelAuth = authHost.includes('vercel.app');

  // Vercel proxy setup: both URLs should be the Vercel app (BETTER_AUTH_URL = .../api/auth)
  if (vercelClient && vercelAuth && authHost === clientHost) {
    console.log('✅ Auth proxy mode: BETTER_AUTH_URL matches Vercel frontend (cookies via /api rewrite).');
    return;
  }

  // Direct cross-origin: API on Render, client on Vercel — cookies often blocked by browsers
  if (renderHost && vercelClient) {
    console.warn(
      '⚠️  Cross-origin auth (Render API + Vercel client) — browsers may block session cookies.',
      '\n   Use Vercel /api proxy (client/vercel.json) and set:',
      `\n   BETTER_AUTH_URL=${clientUrl.replace(/\/+$/, '')}/api/auth`,
      `\n   VITE_API_URL=/api`,
      `\n   VITE_AUTH_URL=/api/auth`,
    );
    return;
  }

  if (clientUrl && authHost === clientHost && !authUrl.includes('/api/auth')) {
    console.error('❌ BETTER_AUTH_URL must include /api/auth path.');
  }

  if (process.env.BETTER_AUTH_SECRET === 'change-me-to-a-long-random-secret'
    || process.env.BETTER_AUTH_SECRET === 'generate-a-long-random-secret-here') {
    console.warn('⚠️  BETTER_AUTH_SECRET is still the placeholder — use a long random value in production.');
  }
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
