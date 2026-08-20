/**
 * Pure cookie helpers for the React Native session store.
 *
 * Extracted from sessionStore.js (which depends on expo-secure-store) so these
 * can be unit-tested in plain Node. No side effects, no native imports.
 */

export function parseCookieHeader(header) {
  const jar = {}
  if (!header) return jar
  for (const piece of header.split(';')) {
    const p = piece.trim()
    if (!p) continue
    const eq = p.indexOf('=')
    if (eq <= 0) continue
    jar[p.slice(0, eq).trim()] = p.slice(eq + 1).trim()
  }
  return jar
}

/**
 * Merge Set-Cookie values into "name=value; name2=value2".
 * Removes cookies that the server clears (empty or "deleted" value).
 */
export function mergeSetCookieHeaders(existingCookie, setCookieList) {
  const jar = parseCookieHeader(existingCookie)

  for (const raw of setCookieList || []) {
    if (!raw) continue
    const part = String(raw).split(';')[0].trim()
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (value === '' || value.toLowerCase() === 'deleted') {
      delete jar[name]
    } else {
      jar[name] = value
    }
  }

  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

/**
 * Extract Set-Cookie from axios-style headers (platform differences).
 */
export function extractSetCookieList(headers) {
  if (!headers) return []
  const collected = []

  const push = (value) => {
    if (!value) return
    if (Array.isArray(value)) {
      value.forEach(push)
      return
    }
    if (typeof value === 'string' && value) collected.push(value)
  }

  if (typeof headers.get === 'function') {
    push(headers.get('set-cookie'))
    push(headers.get('Set-Cookie'))
  }
  if (typeof headers.getSetCookie === 'function') {
    push(headers.getSetCookie())
  }

  push(headers['set-cookie'])
  push(headers['Set-Cookie'])

  const raw = typeof headers.raw === 'function' ? headers.raw() : null
  if (raw) {
    push(raw['set-cookie'])
    push(raw['Set-Cookie'])
  }

  return collected
}

/**
 * If better-auth returns a session token in the JSON body, synthesize the
 * cookie header so subsequent requests are authenticated.
 */
export function cookieFromAuthBody(data, existing = '') {
  const token =
    data?.token ||
    data?.data?.token ||
    data?.session?.token ||
    data?.session?.sessionToken ||
    data?.sessionToken
  if (!token) return existing || ''

  const jar = parseCookieHeader(existing)
  jar['better-auth.session_token'] = token
  jar['__Secure-better-auth.session_token'] = token
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}
