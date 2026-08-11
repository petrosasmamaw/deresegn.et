import axios from 'axios'
import { getApiBaseUrl, getAuthBaseUrl } from './apiBase'
import {
  cookieFromAuthBody,
  extractSetCookieList,
  getSessionCookie,
  mergeSetCookieHeaders,
  setSessionCookie,
  clearSessionCookie,
} from './sessionStore'

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'X-Tamagn-Client': '1',
  'X-Tamagn-Platform': 'mobile',
}

async function withSessionHeaders(extra = {}) {
  const cookie = await getSessionCookie()
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

/**
 * better-auth + app API client for React Native.
 */
export const authApi = {
  async signInEmail({ email, password }) {
    const url = `${getAuthBaseUrl()}/sign-in/email`
    const res = await axios.post(
      url,
      { email, password },
      { headers: await withSessionHeaders(), validateStatus: () => true },
    )
    await captureCookies(res, res.data)
    if (res.status >= 400) {
      throw new Error(authErrorMessage(res.data, 'Login failed'))
    }
    const user = res.data?.user || res.data?.data?.user
    if (!user) throw new Error('Login failed — no user returned')
    return user
  },

  async signUpEmail({ email, password, name }) {
    const url = `${getAuthBaseUrl()}/sign-up/email`
    const res = await axios.post(
      url,
      { email, password, name },
      { headers: await withSessionHeaders(), validateStatus: () => true },
    )
    await captureCookies(res, res.data)
    if (res.status >= 400) {
      throw new Error(authErrorMessage(res.data, 'Signup failed'))
    }
    const user = res.data?.user || res.data?.data?.user
    if (!user) throw new Error('Signup failed — no user returned')
    return user
  },

  async getSession() {
    const sessionUrl = `${getApiBaseUrl()}/auth/get-session`
    const res = await axios.get(sessionUrl, {
      headers: await withSessionHeaders(),
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    if (res.status >= 400 || !res.data) return null
    // body: { user, session } | null from server /api/auth/get-session
    return res.data?.user ? res.data : null
  },

  async signOut() {
    try {
      await axios.post(
        `${getAuthBaseUrl()}/sign-out`,
        {},
        { headers: await withSessionHeaders(), validateStatus: () => true },
      )
    } finally {
      await clearSessionCookie()
    }
  },
}

export const api = {
  async get(path, config = {}) {
    const res = await axios.get(`${getApiBaseUrl()}${path}`, {
      ...config,
      headers: await withSessionHeaders(config.headers),
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    return res
  },

  async post(path, data, config = {}) {
    const isFormData =
      typeof FormData !== 'undefined' && data instanceof FormData

    // RN multipart: omit Content-Type so axios/boundary are set correctly
    const sessionHeaders = await withSessionHeaders(config.headers)
    if (isFormData) {
      delete sessionHeaders['Content-Type']
    }

    const res = await axios.post(`${getApiBaseUrl()}${path}`, data, {
      ...config,
      headers: sessionHeaders,
      validateStatus: () => true,
    })
    await captureCookies(res, res.data)
    return res
  },
}
