/** API / auth bases from VITE_API_URL and VITE_AUTH_URL (.env locally, Vercel in production). */

const isProd = import.meta.env.PROD
const DEV_API_FALLBACK = 'http://localhost:5000/api'
const DEV_AUTH_FALLBACK = 'http://localhost:5000/api/auth'

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return stripTrailingSlash(configured)
  return isProd ? '/api' : DEV_API_FALLBACK
}

/** Better Auth client URL — prefer VITE_AUTH_URL; otherwise derive from API base. */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim()
  if (authUrl) return stripTrailingSlash(authUrl)

  const apiUrl = getApiBaseUrl()
  if (apiUrl === '/api' || apiUrl.endsWith('/api')) {
    if (typeof window !== 'undefined' && !apiUrl.startsWith('http')) {
      return `${window.location.origin}${apiUrl}/auth`
    }
    return `${apiUrl}/auth`
  }
  return isProd ? '/api/auth' : DEV_AUTH_FALLBACK
}
