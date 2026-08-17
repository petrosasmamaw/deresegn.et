/**
 * Lets the HTTP layer notify the app of a 401 without importing Redux
 * (avoids circular deps with http.js ↔ store).
 */
let handler = null
let lastFiredAt = 0

export function setUnauthorizedHandler(fn) {
  handler = typeof fn === 'function' ? fn : null
}

export function notifyUnauthorized() {
  const now = Date.now()
  if (now - lastFiredAt < 1200) return
  lastFiredAt = now
  handler?.()
}
