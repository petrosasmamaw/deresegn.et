import { env as workerEnv } from 'cloudflare:workers';

/** Copy Worker bindings/secrets into process.env for existing Express modules. */
export function syncWorkerEnv() {
  if (!workerEnv || typeof workerEnv !== 'object') return;
  for (const [key, value] of Object.entries(workerEnv)) {
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      try {
        process.env[key] = String(value);
      } catch {
        // ignore read-only keys
      }
    }
  }
}
