/** Redis rate-limit store is unused on Workers — KV limiters replace it. */
export async function makeRateLimitStore() {
  return undefined;
}
