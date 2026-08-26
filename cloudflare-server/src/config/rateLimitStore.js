/**
 * Edge-compatible Rate Limit Store for Cloudflare Workers & Node.js
 */
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { logger } from './logger.js';

class EdgeMemoryStore {
  constructor() {
    this.hits = new Map();
  }

  async init() {}

  async increment(key) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetTime <= now) {
      const resetTime = now + 60000;
      this.hits.set(key, { totalHits: 1, resetTime });
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }
    entry.totalHits += 1;
    return { totalHits: entry.totalHits, resetTime: new Date(entry.resetTime) };
  }

  async decrement(key) {
    const entry = this.hits.get(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(key) {
    this.hits.delete(key);
  }
}

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

export function makeRateLimitStore() {
  const client = initClient();
  if (client) {
    try {
      return new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
      });
    } catch (err) {
      logger.error('RedisStore creation failed (using edge memory store)', { message: err.message });
    }
  }

  return new EdgeMemoryStore();
}
