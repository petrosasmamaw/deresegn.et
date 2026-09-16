/** API / auth bases from VITE_API_URL and VITE_AUTH_URL (.env locally, Vercel in production). */

const isProd = import.meta.env.PROD
const DEV_API_FALLBACK = 'http://localhost:5000/api'
const DEV_AUTH_FALLBACK = 'http://localhost:5000/api/auth'

function normalizeUrl(url) {
  if (!url) return ''
  let trimmed = String(url).trim().replace(/\/+$/, '')
  if (trimmed.startsWith('/')) return trimmed
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }
  return trimmed
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return normalizeUrl(configured)
  return isProd ? '/api' : DEV_API_FALLBACK
}

/** Better Auth client URL — prefer VITE_AUTH_URL; otherwise derive from API base. */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim()
  if (authUrl) return normalizeUrl(authUrl)

  const apiUrl = getApiBaseUrl()
  if (apiUrl === '/api') {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth`
    }
    return '/api/auth'
  }
  if (apiUrl.endsWith('/api')) {
    return `${apiUrl}/auth`
  }
  return isProd ? '/api/auth' : DEV_AUTH_FALLBACK
}
