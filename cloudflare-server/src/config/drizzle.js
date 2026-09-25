import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema.js';

config();

if (neonConfig) {
  neonConfig.fetchConnectionCache = true;
}

let _sql = null;
let _db = null;

export function getDb() {
  if (!_db) {
    let connectionString = process.env.DATABASE_URL || '';
    if (connectionString && connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
      connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
    }
    _sql = neon(connectionString);
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export const db = new Proxy({}, {
  get(_target, prop) {
    const d = getDb();
    if (prop === 'transaction') {
      return async (callback, ...args) => {
        try {
          if (typeof d.transaction === 'function') {
            return await d.transaction(callback, ...args);
          }
        } catch (err) {
          if (/No transactions support in neon-http driver/i.test(err?.message || '')) {
            return await callback(d);
          }
          throw err;
        }
        return await callback(d);
      };
    }
    const val = d[prop];
    return typeof val === 'function' ? val.bind(d) : val;
  },
});

export const pool = {
  async query(queryString) {
    return getDb().execute(queryString);
  },
  async end() {
    _sql = null;
    _db = null;
  },
};

export async function closePool() {
  _sql = null;
  _db = null;
}

export async function testConnection() {
  try {
    const result = await getDb().execute('SELECT NOW()');
    console.log('✅ Database connected:', result);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
