/**
 * Lightweight web logger with a single, optional hook for crash reporting.
 *
 * Error monitoring is inert by default and activates without any code change:
 * if a Sentry browser SDK is present on `window.Sentry` (e.g. loaded via the
 * Sentry loader snippet / CDN using VITE_SENTRY_DSN), errors are forwarded to
 * it. Otherwise we simply log to the console. No hard dependency, no build
 * breakage.
 */
const isDev = import.meta?.env?.MODE !== 'production'

function report(error, meta) {
  try {
    if (typeof window !== 'undefined' && window.Sentry?.captureException) {
      window.Sentry.captureException(error, meta ? { extra: meta } : undefined)
    }
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
    console.error(`[error] ${message}`, meta ?? '')
    report(message instanceof Error ? message : new Error(String(message)), meta)
  },
  capture(error, meta) {
    console.error('[error]', error, meta ?? '')
    report(error, meta)
  },
}

export default logger
