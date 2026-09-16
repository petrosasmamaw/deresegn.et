/**
 * Minimal structured logger with levels. No external dependency.
 * Set LOG_LEVEL=error|warn|info|debug (default: info).
 *
 * Output is a single line: "<ISO> <LEVEL> <message> <meta-json?>", which is
 * easy to read in Render logs and greppable. Errors always print a stack when
 * an Error is passed as meta.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configured = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configured] ?? LEVELS.info;

function serializeMeta(meta) {
  if (meta === undefined || meta === null) return '';
  if (meta instanceof Error) {
    return ` ${JSON.stringify({ message: meta.message, stack: meta.stack })}`;
  }
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${String(meta)}`;
  }
}

function emit(level, sink, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${serializeMeta(meta)}`;
  sink(line);
}

export const logger = {
  error: (message, meta) => emit('error', console.error, message, meta),
  warn: (message, meta) => emit('warn', console.warn, message, meta),
  info: (message, meta) => emit('info', console.log, message, meta),
  debug: (message, meta) => emit('debug', console.log, message, meta),
};

export default logger;
