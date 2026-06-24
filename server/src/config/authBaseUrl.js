/** Resolve Better Auth public URL (browser-facing, via Vercel proxy when applicable). */
export function resolveAuthBaseUrl() {
  const clientUrl = (process.env.CLIENT_URL || '').trim().replace(/\/+$/, '');
  const configured = (process.env.BETTER_AUTH_URL || '').trim().replace(/\/+$/, '');
  const fallback = 'http://localhost:5000/api/auth';
  const isProduction = process.env.NODE_ENV === 'production';

  if (!configured) {
    return isProduction && clientUrl ? `${clientUrl}/api/auth` : fallback;
  }

  // Render API + Vercel client: cookies only work through the Vercel /api proxy.
  if (
    isProduction
    && clientUrl.includes('vercel.app')
    && configured.includes('onrender.com')
  ) {
    const proxyUrl = `${clientUrl}/api/auth`;
    console.warn(
      '⚠️  BETTER_AUTH_URL points to Render — auto-using Vercel proxy URL for session cookies:',
      proxyUrl,
    );
    return proxyUrl;
  }

  return configured;
}

export function usesVercelProxyAuth() {
  const authUrl = resolveAuthBaseUrl();
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  if (!clientUrl) return false;
  try {
    const authHost = new URL(authUrl).hostname;
    const clientHost = new URL(clientUrl).hostname;
    return authHost.includes('vercel.app') && authHost === clientHost;
  } catch {
    return false;
  }
}
