import axios from 'axios'
import { getApiBaseUrl, getAuthBaseUrl, getWebBaseUrl } from './apiBase'
import {
  cookieFromAuthBody,
  extractSetCookieList,
  getSessionCookie,
  mergeSetCookieHeaders,
  setSessionCookie,
  clearSessionCookie,
} from './sessionStore'
import { notifyUnauthorized } from './sessionExpired'

const REQUEST_TIMEOUT_MS = 25000

/** Better Auth needs a trusted website Origin; installed APK sends null without this. */
function clientOriginHeaders() {
  const web = getWebBaseUrl()
  if (!web) return {}
  return {
    Origin: web,
    Referer: `${web}/`,
  }
}

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-Tamagn-Client': '1',
  'X-Tamagn-Platform': 'mobile',
  ...clientOriginHeaders(),
}

async function withSessionHeaders(extra = {}, { includeCookie = true } = {}) {
  const cookie = includeCookie ? await getSessionCookie() : ''
  return {
    ...COMMON_HEADERS,
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  }
}

async function captureCookies(response, body) {
  const prev = await getSessionCookie()
  let next = prev
  const setCookies = extractSetCookieList(response.headers)
  if (setCookies.length) {
    next = mergeSetCookieHeaders(prev, setCookies)
  }
  const fromBody = cookieFromAuthBody(body, next)
  if (fromBody) next = fromBody
  if (next && next !== prev) {
    await setSessionCookie(next)
  }
  return next
}

function authErrorMessage(body, fallback) {
  if (!body) return fallback
  if (typeof body === 'string') return body
  return body.message || body.error || body.error?.message || fallback
}

function networkError(err, fallback) {
  const msg = String(err?.message || '')
  if (
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ERR_NETWORK' ||
    /timeout|network request failed|network error/i.test(msg)
  ) {
    return new Error('NETWORK_UNREACHABLE')
  }
  return new Error(msg || fallback)
}

async function authPost(path, payload, fallback) {
  try {
    const res = await axios.post(`${getAuthBaseUrl()}${path}`, payload, {
      headers: await withSessionHeaders({}, { includeCookie: false }),
      validateStatus: () => true,
      timeout: REQUEST_TIMEOUT_MS,
    })
    await captureCookies(res, res.data)
    if (res.status >= 400) {
      throw new Error(authErrorMessage(res.data, fallback))
    }
    const user = res.data?.user || res.data?.data?.user
    if (!user) throw new Error(`${fallback} — no user returned`)
    return user
  } catch (err) {
    if (err instanceof Error && err.message && err.name !== 'AxiosError') throw err
    throw networkError(err, fallback)
  }
}

/**
 * better-auth + app API client for React Native.
 */
export const authApi = {
  async signInEmail({ email, password }) {
    await clearSessionCookie()
    return authPost('/sign-in/email', { email, password }, 'Login failed')
  },

  async signUpEmail({ email, password, name }) {
    await clearSessionCookie()
    return authPost('/sign-up/email', { email, password, name }, 'Signup failed')
  },

  async getSession() {
    const cookie = await getSessionCookie()
    if (!cookie) return null

    try {
      const sessionUrl = `${getApiBaseUrl()}/auth/get-session`
      const res = await axios.get(sessionUrl, {
        headers: await withSessionHeaders(),
        validateStatus: () => true,
        timeout: REQUEST_TIMEOUT_MS,
      })
      await captureCookies(res, res.data)
      if (res.status >= 400 || !res.data?.user) {
        await clearSessionCookie()
        return null
      }
      return res.data?.user ? res.data : null
    } catch {
      return null
    }
  },

  async signOut() {
    try {
      const cookie = await getSessionCookie()
      if (cookie) {
        await axios.post(
          `${getAuthBaseUrl()}/sign-out`,
          {},
          {
            headers: await withSessionHeaders(),
            validateStatus: () => true,
            timeout: REQUEST_TIMEOUT_MS,
          },
        )
      }
    } finally {
      await clearSessionCookie()
    }
  },
}

async function maybeUnauthorized(res) {
  if (res?.status !== 401) return
  await clearSessionCookie()
  notifyUnauthorized()
}

function withTimeout(config = {}) {
  return { timeout: REQUEST_TIMEOUT_MS, ...config }
}

export const api = {
  async get(path, config = {}) {
    const res = await axios.get(`${getApiBaseUrl()}${path}`, {
      ...withTimeout(config),
      headers: await withSessionHeaders(config.headers),
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    await maybeUnauthorized(res)
    return res
  },

  async post(path, data, config = {}) {
    const isFormData =
      typeof FormData !== 'undefined' && data instanceof FormData

    const sessionHeaders = await withSessionHeaders(config.headers)
    if (isFormData) {
      delete sessionHeaders['Content-Type']
    }

    const res = await axios.post(`${getApiBaseUrl()}${path}`, data, {
      ...withTimeout(config),
      headers: sessionHeaders,
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    await maybeUnauthorized(res)
    return res
  },

  async put(path, data, config = {}) {
    const res = await axios.put(`${getApiBaseUrl()}${path}`, data, {
      ...withTimeout(config),
      headers: await withSessionHeaders(config.headers),
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    await maybeUnauthorized(res)
    return res
  },

  async delete(path, config = {}) {
    const res = await axios.delete(`${getApiBaseUrl()}${path}`, {
      ...withTimeout(config),
      headers: await withSessionHeaders(config.headers),
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    await maybeUnauthorized(res)
    return res
  },
}
