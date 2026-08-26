/**
 * Initialise browser error monitoring (Sentry) only when a DSN is configured.
 * The SDK is dynamically imported so it lands in its own chunk and never bloats
 * the main bundle for deployments that don't use it. Fully inert without a DSN.
 */
export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/browser')
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Keep it light: errors only by default, no performance tracing unless set.
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
    })
    // Expose for the logger's `window.Sentry.captureException` hook.
    window.Sentry = Sentry
  } catch {
    // Monitoring must never block app startup.
  }
}
