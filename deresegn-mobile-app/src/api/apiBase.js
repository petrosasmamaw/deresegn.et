/** API / auth / public website base URLs — set EXPO_PUBLIC_* in .env */
import { Platform } from 'react-native'
import Constants from 'expo-constants'

function stripSlash(url) {
  return url.replace(/\/+$/, '')
}

/**
 * Automatically determine the developer PC's host IP (e.g. 192.168.1.14)
 * from the Expo Metro bundler connection or browser window.
 */
function getDevHostIp() {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest2?.extra?.expoClient?.hostUri ||
      Constants.experienceUrl ||
      ''
    if (hostUri) {
      const match = hostUri.match(/^(?:[a-zA-Z0-9+.-]+:\/\/)?([^:/]+)/)
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return match[1]
      }
    }
  } catch {
    // Ignore in environments where Constants is unavailable
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const h = window.location.hostname
    if (h && h !== 'localhost' && h !== '127.0.0.1') {
      return h
    }
  }

  return null
}

/**
 * Rewrite local dev hosts (localhost, 127.0.0.1, 10.0.2.2) to the correct reachable host:
 * 1. Physical phone (via Expo Go / LAN) or Web on phone: uses detected Metro IP (e.g. 192.168.1.14).
 * 2. Android emulator: uses 10.0.2.2 if no Metro IP detected.
 * 3. iOS simulator / desktop web: keeps localhost.
 * 4. Production URLs (https://...): untouched.
 */
function resolveDevUrl(url) {
  if (!url) return url

  const devHost = getDevHostIp()
  if (devHost) {
    return url.replace(/:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(?=[:/]|$)/g, `://${devHost}`)
  }

  if (Platform.OS === 'android') {
    return url.replace(/:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/g, '://10.0.2.2')
  }

  return url
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (configured) return stripSlash(resolveDevUrl(configured))

  const devHost = getDevHostIp()
  if (devHost) {
    return `http://${devHost}:5000/api`
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api'
}

export function getAuthBaseUrl() {
  const authUrl = process.env.EXPO_PUBLIC_AUTH_URL?.trim()
  if (authUrl) return stripSlash(resolveDevUrl(authUrl))

  const apiUrl = getApiBaseUrl()
  if (apiUrl.endsWith('/api')) {
    return `${apiUrl}/auth`
  }

  const devHost = getDevHostIp()
  if (devHost) {
    return `http://${devHost}:5000/api/auth`
  }

  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api/auth'
    : 'http://localhost:5000/api/auth'
}

/** Public web origin for shareable certificate links (/verify/:token). */
export function getWebBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim()
  if (configured) return stripSlash(configured)
  return 'https://tamagncheck.online'
}
