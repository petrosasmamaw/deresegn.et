/**
 * Lightweight app logger. Central place to route logs so a crash-reporting
 * service (e.g. Sentry) can be added in ONE spot without touching call sites.
 *
 * Error monitoring is pluggable and inert by default. To activate Sentry:
 *   1) npm i @sentry/react-native  (and run the Expo config plugin setup)
 *   2) at app startup call:
 *        import * as Sentry from '@sentry/react-native'
 *        Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN })
 *        setErrorReporter((error, meta) => Sentry.captureException(error, { extra: meta }))
 *
 * We intentionally do NOT statically import the Sentry package here so the
 * Metro bundler never requires it to be installed.
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true

let errorReporter = null

/** Register a crash reporter (e.g. Sentry). Safe to leave unset. */
export function setErrorReporter(fn) {
  errorReporter = typeof fn === 'function' ? fn : null
}

function report(error, meta) {
  if (!errorReporter) return
  try {
    errorReporter(error instanceof Error ? error : new Error(String(error)), meta)
  } catch {
    // Monitoring must never break the app.
  }
}

export const logger = {
  info(message, meta) {
    if (isDev) console.log(`[info] ${message}`, meta ?? '')
  },
  warn(message, meta) {
    if (isDev) console.warn(`[warn] ${message}`, meta ?? '')
  },
  error(message, meta) {
    // Always surface errors; forward to the reporter when one is registered.
    console.error(`[error] ${message}`, meta ?? '')
    report(message, meta)
  },
}

export default logger
