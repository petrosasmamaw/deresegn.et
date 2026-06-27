/** API base — set VITE_API_URL / VITE_AUTH_URL in .env (local) or Vercel env (production). */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return 'http://localhost:5000/api';
}

/** Better Auth client URL — must be a full absolute URL. */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/+$/, '');

  const apiUrl = getApiBaseUrl();
  if (apiUrl.startsWith('http') && apiUrl.endsWith('/api')) {
    return `${apiUrl}/auth`;
  }

  return 'http://localhost:5000/api/auth';
}
