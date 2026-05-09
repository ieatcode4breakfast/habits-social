import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';

neonConfig.webSocketConstructor = ws;
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { H3Event } from 'h3';

export const useDB = (event?: H3Event) => {
  let config: any = {};
  try {
    config = useRuntimeConfig(event);
  } catch (e) {
    // Fallback for tests or environments where useRuntimeConfig is unavailable
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

  const pool = new Pool({ connectionString: uri });
  return drizzle(pool, { schema });
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
 */
export async function getServerTime(db: any): Promise<number> {
  const result = await db.execute(sql`SELECT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint as now`);
  const rows = extractRows<{ now: string | number }>(result);
  if (!rows[0]) {
    throw new Error('Failed to get server time from database');
  }
  return Math.floor(Number(rows[0].now));
}

