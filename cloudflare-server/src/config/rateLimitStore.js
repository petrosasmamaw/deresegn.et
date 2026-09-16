/**
 * Optional shared rate-limit store.
 *
 * Default (no REDIS_URL): returns `undefined`, so express-rate-limit uses its
 * built-in in-memory store — identical to previous behavior. Set REDIS_URL to
 * make rate limits consistent across multiple instances/restarts.
 *
 * This is intentionally defensive: any Redis failure falls back to memory and
 * never crashes the app or blocks auth.
 */
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { logger } from './logger.js';

let sharedClient = null;
let initialized = false;

function initClient() {
  if (initialized) return sharedClient;
  initialized = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  try {
    sharedClient = createClient({ url });
    sharedClient.on('error', (err) => {
      logger.error('Redis rate-limit client error (falling back to memory)', {
        message: err.message,
      });
    });
    // Connect in the background; rate-limit-redis queues commands until ready.
    sharedClient.connect().then(
      () => logger.info('Redis connected for rate limiting'),
      (err) => logger.error('Redis connect failed (using memory store)', { message: err.message }),
    );
  } catch (err) {
    logger.error('Redis init failed (using memory store)', { message: err.message });
    sharedClient = null;
  }

  return sharedClient;
}

/**
 * Returns a store option for express-rate-limit, or `undefined` for the
 * default in-memory store. Each limiter should call this to get its own store
 * instance (they share one Redis connection).
 */
export function makeRateLimitStore() {
  const client = initClient();
  if (!client) return undefined;

  try {
    return new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
    });
  } catch (err) {
    logger.error('RedisStore creation failed (using memory store)', { message: err.message });
    return undefined;
  }
}
