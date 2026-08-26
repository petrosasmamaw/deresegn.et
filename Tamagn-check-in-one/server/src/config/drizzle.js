import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '../../.env') });
config({ path: path.join(here, '../.env') });
config();

// Configure SSL for Neon and other hosted Postgres providers.
const isNeon = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  // Timeouts so a slow/unreachable DB fails fast instead of hanging startup.
  max: Number(process.env.DB_POOL_MAX) || 10,
  connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
});

// Never let a background pool error crash the process.
pool.on('error', (err) => {
  console.error('[db] Unexpected idle client error:', err.message);
});

export const db = drizzle(pool, { schema });

/** Close the pool during graceful shutdown. */
export async function closePool() {
  try {
    await pool.end();
  } catch {
    // ignore — process is exiting
  }
}

export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
