/** API / auth / public website base URLs — set EXPO_PUBLIC_* in .env */

function stripSlash(url) {
  return url.replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (configured) return stripSlash(configured)
  // Android emulator → host machine. iOS simulator can use localhost.
  // Physical device: set EXPO_PUBLIC_API_URL to your LAN IP.
  return 'http://10.0.2.2:5000/api'
}

export function getAuthBaseUrl() {
  const authUrl = process.env.EXPO_PUBLIC_AUTH_URL?.trim()
  if (authUrl) return stripSlash(authUrl)

  const apiUrl = getApiBaseUrl()
  if (apiUrl.endsWith('/api')) {
    return `${apiUrl}/auth`
  }
  return 'http://10.0.2.2:5000/api/auth'
}

/** Public web origin for shareable certificate links (/verify/:token). */
export function getWebBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim()
  if (configured) return stripSlash(configured)
  return 'https://tamagncheck.online'
}
