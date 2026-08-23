/** API base — set VITE_API_URL / VITE_AUTH_URL in .env (local) or Vercel env (production). */

const isProd = import.meta.env.PROD
const DEV_API_FALLBACK = 'http://localhost:8787/api'
const DEV_AUTH_FALLBACK = 'http://localhost:8787/api/auth'

function isWorkersDevUrl(url) {
  try {
    return /\.workers\.dev$/i.test(new URL(url).hostname)
  } catch {
    return /\.workers\.dev/i.test(String(url || ''))
  }
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  // Production site uses vercel.json rewrite → Worker. Never call workers.dev
  // from the browser when a same-origin /api proxy exists (cookie domain mismatch).
  if (isProd) {
    if (!configured || configured === '/api' || isWorkersDevUrl(configured)) {
      return '/api'
    }
    return configured.replace(/\/+$/, '')
  }
  if (configured) return configured.replace(/\/+$/, '')
  return DEV_API_FALLBACK
}

/** Better Auth client URL — must share the cookie origin with getApiBaseUrl(). */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim()

  if (isProd) {
    // Same-origin auth so Set-Cookie lands on tamagncheck.online and is sent to /api/*.
    if (typeof window !== 'undefined') {
      if (!authUrl || isWorkersDevUrl(authUrl) || authUrl.startsWith('/')) {
        return `${window.location.origin}/api/auth`
      }
      // Allow explicit same-site https://tamagncheck.online/api/auth
      try {
        if (new URL(authUrl).origin === window.location.origin) {
          return authUrl.replace(/\/+$/, '')
        }
      } catch {
        // fall through to same-origin
      }
      return `${window.location.origin}/api/auth`
    }
    if (authUrl && !isWorkersDevUrl(authUrl)) return authUrl.replace(/\/+$/, '')
    return '/api/auth'
  }

  if (authUrl) return authUrl.replace(/\/+$/, '')

  const apiUrl = getApiBaseUrl()
  if (apiUrl === '/api' || apiUrl.endsWith('/api')) {
    if (typeof window !== 'undefined' && !apiUrl.startsWith('http')) {
      return `${window.location.origin}${apiUrl}/auth`
    }
    return `${apiUrl}/auth`
  }
  return DEV_AUTH_FALLBACK
}
