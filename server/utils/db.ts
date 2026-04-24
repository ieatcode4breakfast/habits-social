import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../database/schema';

export const useDB = (event: any) => {
  const runtimeConfig = useRuntimeConfig();
  
  // In Cloudflare, the DB binding is on event.context.cloudflare.env
  // Locally with Nuxt/Nitro, it might be mocked or provided differently
  const dbBinding = event.context.cloudflare?.env?.DB;
  
  if (!dbBinding) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Database binding not found.',
    });
  }

  return drizzle(dbBinding, { schema });
};

// For backward compatibility during migration
export const connectDB = async () => {
  // This is now a no-op as D1 is always "connected"
  return;
};
