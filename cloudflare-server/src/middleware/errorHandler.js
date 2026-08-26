import { logger } from '../config/logger.js';
import { captureError } from '../config/errorMonitor.js';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Central error handler.
 * - 4xx: client-facing errors keep their specific message (unchanged behavior).
 * - 5xx: log full detail server-side, but return a generic message in
 *   production so internals/stack details never leak to clients.
 */
export default function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error('Unhandled request error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
    // Fire-and-forget: reports to Sentry only if SENTRY_DSN is configured.
    captureError(err, {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
    });
  } else {
    logger.warn('Request error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status,
      message: err.message,
    });
  }

  if (res.headersSent) {
    return next(err);
  }

  const clientMessage =
    status >= 500 && isProduction
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message: clientMessage,
    requestId: req.id,
  });
}
