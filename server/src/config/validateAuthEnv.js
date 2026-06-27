/** Warn when production auth env is misconfigured. */
export function validateAuthEnv() {
  const authUrl = (process.env.BETTER_AUTH_URL || '').trim();
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) return;

  if (!authUrl) {
    console.error('❌ BETTER_AUTH_URL is missing on Render.');
    return;
  }

  if (!clientUrl) {
    console.warn('⚠️  CLIENT_URL is missing — set your Vercel app URL for CORS and cookies.');
  }

  const authHost = hostFromUrl(authUrl);
  const clientHost = hostFromUrl(clientUrl);

  if (clientUrl && authHost && clientHost && authHost !== clientHost) {
    console.log(
      '✅ Direct API mode: frontend on',
      clientHost,
      '→ API on',
      authHost,
      '(cross-origin cookies: SameSite=None).',
    );
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
