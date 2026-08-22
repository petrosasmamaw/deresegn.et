/**
 * Request-scoped env + db for Cloudflare Workers.
 * Services still import { db } / process.env; we sync bindings into process.env
 * and swap the module-level db handle per request via AsyncLocalStorage.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const requestContext = new AsyncLocalStorage();

export function getRequestEnv() {
  return requestContext.getStore()?.env || globalThis.__WORKER_ENV || {};
}

export function getRequestDb() {
  const store = requestContext.getStore();
  if (store?.db) return store.db;
  throw new Error('Database is not initialized for this request');
}

export function getRequestAuth() {
  const store = requestContext.getStore();
  if (store?.auth) return store.auth;
  throw new Error('Auth is not initialized for this request');
}

/** Copy Worker bindings into process.env so existing modules keep working. */
export function syncEnvToProcess(env) {
  if (!env || typeof env !== 'object') return;
  globalThis.__WORKER_ENV = env;
  for (const [key, value] of Object.entries(env)) {
    if (value == null) continue;
    if (key === 'NODE_ENV') continue; // compile-time define in Wrangler — do not assign
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      try {
        process.env[key] = String(value);
      } catch {
        // ignore read-only env keys
      }
    }
  }
}

export function runWithRequestContext(store, fn) {
  return requestContext.run(store, fn);
}
