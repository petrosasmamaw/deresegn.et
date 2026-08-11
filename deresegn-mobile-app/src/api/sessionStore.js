import * as SecureStore from 'expo-secure-store'

const COOKIE_KEY = 'tamagn_session_cookie'

/**
 * Persist better-auth session cookie(s) for RN.
 * Web uses httpOnly browser cookies; mobile stores the Cookie header value securely.
 */
export async function getSessionCookie() {
  try {
    return (await SecureStore.getItemAsync(COOKIE_KEY)) || ''
  } catch {
    return ''
  }
}

export async function setSessionCookie(cookieHeader) {
  try {
    if (!cookieHeader) {
      await SecureStore.deleteItemAsync(COOKIE_KEY)
      return
    }
    await SecureStore.setItemAsync(COOKIE_KEY, cookieHeader)
  } catch {
    // ignore secure store errors in web/dev
  }
}

export async function clearSessionCookie() {
  return setSessionCookie('')
}

/**
 * Merge Set-Cookie values into "name=value; name2=value2"
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

function parseCookieHeader(header) {
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
 * Extract Set-Cookie from axios-style headers (platform differences).
 */
export function extractSetCookieList(headers) {
  if (!headers) return []
  const get = (name) => {
    if (typeof headers.get === 'function') return headers.get(name)
    return headers[name] ?? headers[name.toLowerCase()]
  }

  const multi = get('set-cookie')
  if (Array.isArray(multi)) return multi
  if (typeof multi === 'string' && multi) return [multi]

  // Some RN stacks only expose via raw
  const raw = headers['set-cookie'] || headers['Set-Cookie']
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw) return [raw]

  return []
}

/**
 * If better-auth returns session token in JSON body, synthesize cookie.
 */
export function cookieFromAuthBody(data, existing = '') {
  const token =
    data?.token ||
    data?.session?.token ||
    data?.session?.sessionToken ||
    data?.sessionToken
  if (!token) return existing || ''

  const jar = parseCookieHeader(existing)
  // Common better-auth cookie names
  jar['better-auth.session_token'] = token
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}
