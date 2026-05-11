import { Pool, neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { H3Event } from 'h3';

let cachedPool: Pool | null = null;
let cachedDb: any = null;

export const useDB = (event?: H3Event) => {
  // 1. Request-scoped cache (Highest priority for Cloudflare Workers I/O safety)
  if (event?.context?._db) return event.context._db;

  // 2. Global singleton fallback (Tests or background startup)
  if (!event && cachedDb) return cachedDb;

  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {
    // Fallback for tests
  }

  const cf = (event as any)?.context?.cloudflare;
  
  const uri = (config.databaseUrl as string)
    || cf?.env?.DATABASE_URL
    || cf?.env?.NUXT_DATABASE_URL
    || (process as any)?.env?.DATABASE_URL
    || (process as any)?.env?.NUXT_DATABASE_URL;

  if (!uri) {
    console.error('DATABASE_URL is missing.');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  let db: any;
  const isProduction = process.env.NODE_ENV === 'production' || !!cf;

  if (isProduction) {
    // Stateless HTTP mode for Production/Workers
    const sqlClient = neon(uri);
    db = drizzleHttp(sqlClient, { schema });
  } else {
    // Stateful Pool mode for Development/Tests
    if (!cachedPool) {
      cachedPool = new Pool({ connectionString: uri });
    }
    db = drizzle(cachedPool, { schema });
  }

  // Cache appropriately
  if (event) {
    event.context._db = db;
  } else {
    cachedDb = db;
  }

  return db;
};

/**
 * Extracts rows from a Drizzle execute result, handling both array and object formats.
 */
export function extractRows<T>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.rows && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Gets the current server time from the database as a numeric timestamp (ms).
 * Accepts standard DB instance or transaction instance.
 */
export async function getServerTime(db: any): Promise<number> {
  const result = await db.execute(sql`SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint as now`);
  const rows = extractRows<{ now: string | number }>(result);
  if (!rows[0]) {
    throw new Error('Failed to get server time from database');
  }
  return Math.floor(Number(rows[0].now));
}

