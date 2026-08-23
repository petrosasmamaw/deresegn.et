/** Cloudflare Workers — no Node fs; use fetch/HTTP drivers and tighter CPU budgets. */
export function isWorkersRuntime() {
  return typeof globalThis.caches !== 'undefined';
}
