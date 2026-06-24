function isLocalDev() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/** True when the app should call same-origin /api (Vercel proxy → Render). */
function shouldUseSameOriginApi() {
  if (typeof window === 'undefined') return false;
  if (isLocalDev()) return false;

  const configured = import.meta.env.VITE_API_URL;
  if (configured?.startsWith('/')) return true;

  return window.location.hostname.endsWith('.vercel.app');
}

function toAbsoluteUrl(pathOrUrl) {
  if (typeof window !== 'undefined' && pathOrUrl.startsWith('/')) {
    return `${window.location.origin}${pathOrUrl}`;
  }
  return pathOrUrl;
}

/** Resolve API base URL for axios (relative /api is fine). */
export function getApiBaseUrl() {
  if (shouldUseSameOriginApi()) {
    return '/api';
  }

  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/+$/, '');

  return 'http://localhost:5000/api';
}

/** Better Auth needs a full URL — never a relative path like /api/auth. */
export function getAuthBaseUrl() {
  let url;

  if (shouldUseSameOriginApi()) {
    url = '/api/auth';
  } else {
    const authUrl = import.meta.env.VITE_AUTH_URL;
    if (authUrl) {
      url = authUrl.replace(/\/+$/, '');
    } else {
      const apiUrl = getApiBaseUrl();
      url = apiUrl.startsWith('/') ? '/api/auth' : `${apiUrl}/auth`;
    }
  }

  return toAbsoluteUrl(url);
}
