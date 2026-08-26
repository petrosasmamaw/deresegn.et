import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema.js';

config();

const dummyUrl = 'postgresql://placeholder:placeholder@ep-placeholder.neon.tech/neondb?sslmode=require';

function getSql() {
  const url = process.env.DATABASE_URL || dummyUrl;
  return neon(url);
}

// Proxy function so neon client uses the injected process.env.DATABASE_URL at runtime
const proxySql = Object.assign(
  (query, params) => {
    const sql = getSql();
    return sql(query, params);
  },
  {
    transaction: (fn, opts) => {
      const sql = getSql();
      return sql.transaction(fn, opts);
    },
  }
);

export const db = drizzle(proxySql, { schema });

export async function closePool() {
  // HTTP-based serverless client does not require pool draining
}

export async function testConnection() {
  try {
    const sql = getSql();
    const result = await sql`SELECT NOW()`;
    console.log('✅ Database connected:', result[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}
