import { setErrorReporter } from './logger'

/**
 * Optional crash reporting (Sentry). Fully inert without EXPO_PUBLIC_SENTRY_DSN
 * and without @sentry/react-native installed — verify/auth flows are untouched.
 *
 * To activate:
 *   npm i @sentry/react-native
 *   set EXPO_PUBLIC_SENTRY_DSN in .env / EAS env
 */
export async function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/react-native')
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0),
    })
    setErrorReporter((error, meta) => {
      Sentry.captureException(error, meta ? { extra: meta } : undefined)
    })
  } catch {
    // SDK not installed or init failed — app continues normally.
  }
}
