/** API base — set VITE_API_URL / VITE_AUTH_URL in .env (local) or Vercel env (production). */

const isProd = import.meta.env.PROD
const DEV_API_FALLBACK = 'http://localhost:5000/api'
const DEV_AUTH_FALLBACK = 'http://localhost:5000/api/auth'

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  // In production, default to same-origin reverse-proxy (/api) via vercel.json
  if (isProd) return '/api'
  return DEV_API_FALLBACK
}

/** Better Auth client URL */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim()
  if (authUrl) return authUrl.replace(/\/+$/, '')

  const apiUrl = getApiBaseUrl()
  if (apiUrl === '/api' || apiUrl.endsWith('/api')) {
    if (typeof window !== 'undefined' && !apiUrl.startsWith('http')) {
      return `${window.location.origin}${apiUrl}/auth`
    }
    return `${apiUrl}/auth`
  }

  if (isProd) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth`
    }
    return '/api/auth'
  }
  return DEV_AUTH_FALLBACK
}
