import { config } from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../db/schema.js';

config();

// Optimize for serverless/edge environments
neonConfig.poolQueryViaFetch = true;

const dummyUrl = 'postgresql://placeholder:placeholder@ep-placeholder.neon.tech/neondb?sslmode=require';

let poolInstance = null;
let currentUrl = null;

function getPool() {
  const url = process.env.DATABASE_URL || dummyUrl;
  if (!poolInstance || currentUrl !== url) {
    if (poolInstance) {
      try { poolInstance.end(); } catch {}
    }
    currentUrl = url;
    poolInstance = new Pool({ connectionString: url });
  }
  return poolInstance;
}

// Proxy handler for Pool to lazily use runtime process.env.DATABASE_URL
const proxyPool = new Proxy({}, {
  get(target, prop) {
    const pool = getPool();
    const val = pool[prop];
    return typeof val === 'function' ? val.bind(pool) : val;
  },
});

export const db = drizzle(proxyPool, { schema });

export async function closePool() {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function testConnection() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
