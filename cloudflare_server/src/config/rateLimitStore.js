/**
 * Cloudflare Workers use in-memory rate limits (per isolate).
 * REDIS_URL is not used on this runtime.
 */
export function makeRateLimitStore() {
  return undefined;
}
