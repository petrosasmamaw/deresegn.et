/** API / auth / public website base URLs — set EXPO_PUBLIC_* in .env */
import { Platform } from 'react-native'

function stripSlash(url) {
  return url.replace(/\/+$/, '')
}

/** Android emulator cannot reach the host via localhost — use 10.0.2.2. */
function rewriteForAndroidEmulator(url) {
  if (Platform.OS !== 'android' || !url) return url
  return url.replace(/:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/g, '://10.0.2.2')
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (configured) return stripSlash(rewriteForAndroidEmulator(configured))
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/api'
    : 'http://localhost:5000/api'
}

export function getAuthBaseUrl() {
  const authUrl = process.env.EXPO_PUBLIC_AUTH_URL?.trim()
  if (authUrl) return stripSlash(rewriteForAndroidEmulator(authUrl))

  const apiUrl = getApiBaseUrl()
  if (apiUrl.endsWith('/api')) {
    return `${apiUrl}/auth`
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
