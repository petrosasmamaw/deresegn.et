/**
 * Tiny registry so the axios instance can notify the app of a 401 without
 * importing the redux store (which would create a circular dependency).
 * `main.jsx` registers a handler that dispatches `sessionExpired`.
 */
let handler = null
let lastFiredAt = 0

export function setUnauthorizedHandler(fn) {
  handler = typeof fn === 'function' ? fn : null
}

export function notifyUnauthorized() {
  // Debounce: a burst of parallel requests can all 401 at once — only act once.
  const now = Date.now()
  if (now - lastFiredAt < 1000) return
  lastFiredAt = now
  if (handler) handler()
}
