/** Warn when production auth env points at the frontend instead of the API host. */
export function validateAuthEnv() {
  const authUrl = (process.env.BETTER_AUTH_URL || '').trim();
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) return;

  if (!authUrl) {
    console.error('❌ BETTER_AUTH_URL is missing. Set it to your API URL, e.g. https://deresegn-et.onrender.com/api/auth');
    return;
  }

  if (authUrl.includes('vercel.app')) {
    console.error(
      '❌ BETTER_AUTH_URL must be your API server (Render), not your Vercel frontend.',
      `\n   Current: ${authUrl}`,
      '\n   Fix to:  https://deresegn-et.onrender.com/api/auth',
    );
  }

  if (clientUrl && authUrl.replace(/\/api\/auth\/?$/, '') === clientUrl.replace(/\/+$/, '')) {
    console.error(
      '❌ BETTER_AUTH_URL and CLIENT_URL must be different hosts (API vs frontend).',
      `\n   BETTER_AUTH_URL: ${authUrl}`,
      `\n   CLIENT_URL: ${clientUrl}`,
    );
  }

  if (process.env.BETTER_AUTH_SECRET === 'change-me-to-a-long-random-secret') {
    console.warn('⚠️  BETTER_AUTH_SECRET is still the placeholder — generate a long random value for production.');
  }
}
