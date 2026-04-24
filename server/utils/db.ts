import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../database/schema';

export const useDB = (event: any) => {
  // In Cloudflare, the D1 binding is provided in the event context
  const dbBinding = event.context.cloudflare?.env?.DB;
  
  if (!dbBinding) {
    // During local development with Nuxt/Nitro, miniflare might provide the binding
    // or we can fallback to a local sqlite if needed, but for D1 we expect the binding.
    throw new Error('Database binding "DB" not found in cloudflare environment');
  }

  return drizzle(dbBinding, { schema });
};
