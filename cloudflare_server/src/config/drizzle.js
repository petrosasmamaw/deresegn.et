import { neon, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import * as schema from '../db/schema.js';
import { getRequestDb } from './requestContext.js';

function resolveConnectionString(env) {
  const connectionString = (env?.DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured on this Worker');
  }
  return connectionString;
}

/**
 * Per-request Drizzle client for Cloudflare Workers.
 * - Neon HTTP for normal queries (auth, reads) — no WebSocket / cross-request I/O issues
 * - Short-lived WebSocket Pool only inside db.transaction() for money paths
 */
export function createDb(env) {
  const connectionString = resolveConnectionString(env);
  const sql = neon(connectionString);
  const db = drizzleHttp(sql, { schema });

  db.transaction = async (fn, config) => {
    const pool = new Pool({ connectionString });
    try {
      const txDb = drizzleWs(pool, { schema });
      return await txDb.transaction(fn, config);
    } finally {
      try {
        await pool.end();
      } catch {
        // ignore pool cleanup errors
      }
    }
  };

  return db;
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
  // no-op — HTTP driver; transactional pools are ended in createDb.transaction
}

export async function testConnection(env) {
  try {
    const database = env ? createDb(env) : getRequestDb();
    const rows = await database.execute('select 1 as ok');
    console.log('✅ Database connected:', rows);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
