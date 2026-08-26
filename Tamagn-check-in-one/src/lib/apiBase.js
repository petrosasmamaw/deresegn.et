/** API / auth bases from VITE_API_URL and VITE_AUTH_URL (.env locally, Vercel in production). */

function stripTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '')
}

/** Turn `/api` into `http://localhost:5173/api` — Better Auth requires an absolute base URL. */
function toAbsoluteUrl(url) {
  const cleaned = stripTrailingSlash(url)
  if (!cleaned) return cleaned
  if (/^https?:\/\//i.test(cleaned)) return cleaned
  const path = cleaned.startsWith('/') ? cleaned : `/${cleaned}`
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  // Vite SSR / build-time fallback (browser overrides on load)
  const origin = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
    ? 'http://localhost:5173'
    : ''
  return origin ? `${origin}${path}` : path
}

/** Same-origin /api (Vite proxy locally, Vercel rewrite in production). */
export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL?.trim()
  return toAbsoluteUrl(configured || '/api')
}

/** Better Auth client URL — must be absolute (e.g. http://localhost:5173/api/auth). */
export function getAuthBaseUrl() {
  const authUrl = import.meta.env.VITE_AUTH_URL?.trim()
  if (authUrl) return toAbsoluteUrl(authUrl)

  const apiUrl = getApiBaseUrl()
  if (apiUrl.endsWith('/api')) return `${apiUrl}/auth`
  return toAbsoluteUrl('/api/auth')
}
