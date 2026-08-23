import { config } from 'dotenv';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import * as schema from '../db/schema.js';
import { isWorkersRuntime } from './runtime.js';

config();

let pool;
let db;

if (isWorkersRuntime()) {
  neonConfig.poolQueryViaFetch = true;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[db] DATABASE_URL is not set on Worker');
  }
  const sql = neon(connectionString || '');
  db = drizzleHttp(sql, { schema });
  db.transaction = async (fn, cfg) => {
    const wsPool = new Pool({ connectionString });
    try {
      const txDb = drizzleWs(wsPool, { schema });
      return await txDb.transaction(fn, cfg);
    } finally {
      await wsPool.end().catch(() => {});
    }
  };
  pool = null;
} else {
  const isNeon = process.env.DATABASE_URL?.includes('neon');
  pool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    ssl: isNeon ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
    max: Number(process.env.DB_POOL_MAX) || 10,
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
  });
  pool.on('error', (err) => {
    console.error('[db] Unexpected idle client error:', err.message);
  });
  db = drizzlePg(pool, { schema });
}

export { db };

export async function closePool() {
  if (!pool) return;
  try {
    await pool.end();
  } catch {
    // ignore
  }
}

export async function testConnection() {
  try {
    if (isWorkersRuntime()) {
      await db.execute('select 1 as ok');
    } else {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Database connected:', result.rows[0]);
    }
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
