/** Resolve API base URL. Production uses same-origin /api proxy (see vercel.json). */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.vercel.app') || host.includes('deresegn')) {
      return '/api';
    }
  }

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
