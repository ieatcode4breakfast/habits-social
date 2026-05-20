import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { H3Event } from 'h3';
import type { DBConnection } from '../types/db';

let cachedPool: Pool | null = null;
let cachedDb: NeonDatabase<typeof schema> | null = null;

export const useDB = (event?: H3Event): NeonDatabase<typeof schema> => {
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
  
  const uri = cf?.env?.DATABASE_URL
    || cf?.env?.NUXT_DATABASE_URL
    || (config.databaseUrl as string)
    || (process as any)?.env?.DATABASE_URL
    || (process as any)?.env?.NUXT_DATABASE_URL;

  if (!uri) {
    console.error('DATABASE_URL is missing.');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  const isProduction = process.env.NODE_ENV === 'production' || !!cf;

  // Configure driver for the environment
  if (isProduction) {
    // Force stateless HTTP fetch for Workers to ensure I/O context safety
    (neonConfig as any).useFetch = true;
  } else {
    // Use WebSockets for local dev/tests where supported (faster)
    (neonConfig as any).useFetch = false;
  }

  // We use a fresh pool configuration but keep the instance creation scoped
  // to avoid cross-request I/O context leakage.
  const pool = new Pool({ connectionString: uri });
  const db = drizzle(pool, { schema });

  // Cache appropriately
  if (event) {
    event.context._db = db;
  } else {
    cachedDb = db;
    cachedPool = pool;
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
export async function getServerTime(db: DBConnection): Promise<number> {
  const result = await db.execute(sql`SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint as now`);
  const rows = extractRows<{ now: string | number }>(result);
  if (!rows[0]) {
    throw new Error('Failed to get server time from database');
  }
  return Math.floor(Number(rows[0].now));
}

