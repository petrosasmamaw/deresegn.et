/** True when running inside Cloudflare Workers (wrangler dev / deploy). */
export function isWorkersRuntime() {
  return typeof globalThis.caches !== 'undefined';
}
