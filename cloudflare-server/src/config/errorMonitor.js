import { logger } from './logger.js';

/**
 * Optional error monitoring (Sentry) that stays completely inert until a
 * SENTRY_DSN is provided AND the `@sentry/node` package is installed.
 *
 * Design goals:
 * - Zero hard dependency: the app boots and runs fine without Sentry installed.
 * - One activation switch: set SENTRY_DSN in the environment.
 * - Never throws: a monitoring failure must never take down a request.
 *
 * To activate in production:
 *   1) npm i @sentry/node
 *   2) set SENTRY_DSN=... (and optionally SENTRY_ENVIRONMENT, SENTRY_TRACES_SAMPLE_RATE)
 */

const DSN = process.env.SENTRY_DSN || '';

let sentryPromise = null;
let disabled = !DSN;

async function loadSentry() {
  if (disabled) return null;
  if (!sentryPromise) {
    sentryPromise = import('@sentry/node')
      .then((Sentry) => {
        Sentry.init({
          dsn: DSN,
          environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
        });
        logger.info('[monitor] Sentry initialised');
        return Sentry;
      })
      .catch((err) => {
        // Package not installed or init failed — degrade to logging only.
        disabled = true;
        logger.warn('[monitor] Sentry unavailable, logging only', { message: err?.message });
        return null;
      });
  }
  return sentryPromise;
}

// Warm up (non-blocking) so the first error doesn't pay the import cost.
if (DSN) {
  loadSentry();
}

/**
 * Report an error to the monitoring backend if configured. Always safe to call.
 * @param {Error|unknown} error
 * @param {object} [context] extra tags/metadata (requestId, method, path, ...)
 */
export async function captureError(error, context = {}) {
  if (disabled) return;
  try {
    const Sentry = await loadSentry();
    if (!Sentry) return;
    Sentry.captureException(error, { extra: context });
  } catch {
    // Monitoring must never break the request path.
  }
}

export const isErrorMonitoringEnabled = () => Boolean(DSN);
