import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../db/schema.js';
import { getRequestDb } from './requestContext.js';

// Prefer HTTP for pool queries on Workers (more reliable than WebSockets locally).
neonConfig.poolQueryViaFetch = true;
if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
}

/**
 * Per-request Drizzle client. Never reuse Pool across requests (Workers I/O isolation).
 */
export function createDb(env) {
  const connectionString = env?.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

/**
 * Lazy proxy so existing `import { db } from '...'` keeps working under ALS.
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getRequestDb();
      const value = real[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    },
  },
);

export async function closePool() {
  // no-op — pool is request-scoped
}

export async function testConnection(env) {
  try {
    const database = env ? createDb(env) : getRequestDb();
    const result = await database.execute('select 1 as ok');
    console.log('✅ Database connected:', result);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
