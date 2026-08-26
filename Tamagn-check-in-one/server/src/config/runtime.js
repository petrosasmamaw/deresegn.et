/** True when running inside Cloudflare Workers (wrangler / Workers deploy). */
export function isWorkersRuntime() {
  return typeof globalThis.caches !== 'undefined';
}
