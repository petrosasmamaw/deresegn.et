import { captureError } from './errorMonitor.js';
import { logger } from './logger.js';

/**
 * Report upstream verifier failures to logs + optional Sentry.
 * Does NOT change verify behaviour — callers still fall through to direct
 * bank paths or return null exactly as before.
 */
export function reportPetrosFailure({ bank, reference, reason, durationMs }) {
  const context = {
    bank,
    reference: String(reference || '').slice(0, 32),
    reason: String(reason || 'unknown').slice(0, 200),
    durationMs,
    dependency: 'petros_verifier',
  };

  logger.warn('[Petros] verifier unavailable', context);

  // Fire-and-forget — monitoring must never block a verify request.
  captureError(new Error(`Petros verifier failed: ${bank}`), context);
}
