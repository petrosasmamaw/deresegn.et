import * as SecureStore from 'expo-secure-store'
import {
  parseCookieHeader,
  mergeSetCookieHeaders,
  extractSetCookieList,
  cookieFromAuthBody,
} from './cookieUtils'

// Re-export pure cookie helpers so existing imports from './sessionStore' keep working.
export { parseCookieHeader, mergeSetCookieHeaders, extractSetCookieList, cookieFromAuthBody }

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
  try {
    await SecureStore.deleteItemAsync(COOKIE_KEY)
  } catch {
    try {
      await SecureStore.setItemAsync(COOKIE_KEY, '')
    } catch {
      // last resort on unsupported platforms
    }
  }
}

