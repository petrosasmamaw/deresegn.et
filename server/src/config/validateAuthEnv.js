import { resolveAuthBaseUrl } from './authBaseUrl.js';
import { getTrustedOrigins } from './clientOrigins.js';

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
    console.warn('⚠️  CLIENT_URL is missing — set your frontend URL(s) for CORS and cookies.');
  }

  const authHost = hostFromUrl(authUrl);
  const resolved = resolveAuthBaseUrl();
  const resolvedHost = hostFromUrl(resolved);
  const trusted = getTrustedOrigins();
  const primaryClient = trusted.find((o) => !o.includes('localhost')) || '';
  const clientHost = hostFromUrl(primaryClient);

  if (authHost.includes('vercel.app') && resolvedHost.includes('onrender.com')) {
    console.error(
      '❌ BETTER_AUTH_URL must NOT point at Vercel when using direct Render API.',
      '\n   Change Render env to:',
      `\n   BETTER_AUTH_URL=${resolved}`,
    );
  } else if (primaryClient && resolvedHost && clientHost && resolvedHost !== clientHost) {
    console.log(
      '✅ Direct API mode: frontends',
      trusted.filter((o) => !o.includes('localhost')).join(', '),
      '→ API on',
      resolvedHost,
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
