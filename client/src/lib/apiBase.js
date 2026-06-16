/** Resolve API base URL. Use `/api` on Vercel (proxied to Render) or full URL locally. */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return 'http://localhost:5000/api';
}

/** Better Auth base URL — must include /api/auth path. */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL;
  if (authUrl) return authUrl.replace(/\/+$/, '');

  const apiUrl = getApiBaseUrl();
  if (apiUrl.startsWith('/')) return '/api/auth';
  return `${apiUrl}/auth`;
}
