import { neon } from '@neondatabase/serverless';
import type { H3Event } from 'h3';

export const useDB = (event?: H3Event) => {
  const config = useRuntimeConfig(event);
  const uri = (config.databaseUrl as string)
    || (event as any)?.context?.cloudflare?.env?.DATABASE_URL
    || process.env.DATABASE_URL;

  if (!uri) {
    console.error('DATABASE_URL is missing');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  // Neon handles connection pooling transparently in serverless environments
  // so we just return the query function directly.
  return neon(uri);
};
