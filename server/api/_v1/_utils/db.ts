import { neon } from '@neondatabase/serverless';
import type { H3Event } from 'h3';
import { toCamelCase } from './transform';

export const useDB = (event?: H3Event) => {
  const config = useRuntimeConfig(event);
  const cf = (event as any)?.context?.cloudflare;
  
  const uri = (config.databaseUrl as string)
    || cf?.env?.DATABASE_URL
    || cf?.env?.NUXT_DATABASE_URL
    || (process as any)?.env?.DATABASE_URL
    || (process as any)?.env?.NUXT_DATABASE_URL;

  if (!uri) {
    console.error('DATABASE_URL is missing. Checked: config, cloudflare.env, and process.env');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  // Neon handles connection pooling transparently in serverless environments
  // so we just return the query function directly.
  const sql = neon(uri);

  // Wrap the sql function to automatically convert results to camelCase
  const wrappedSql = async (...args: any[]) => {
    // @ts-ignore
    const result = await sql(...args);
    return toCamelCase(result);
  };

  return wrappedSql as typeof sql;
};

