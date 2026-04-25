import { MongoClient, Db } from 'mongodb';
import type { H3Event } from 'h3';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export const useDB = async (event?: H3Event): Promise<Db> => {
  if (dbInstance) return dbInstance;

  const config = useRuntimeConfig(event);
  // Try config, then cloudflare env directly, then process.env as last resort
  const uri = config.mongodbUri as string || (event as any)?.context?.cloudflare?.env?.MONGODB_URI || process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('MONGODB_URI is not defined in any context.');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration is missing' });
  }

  try {
    if (!client) {
      client = new MongoClient(uri);
      await client.connect();
      console.log('Connected to MongoDB via native driver');
    }
    // Using the default database specified in the connection string
    dbInstance = client.db();
    return dbInstance;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw createError({ statusCode: 500, statusMessage: 'Database connection failed' });
  }
};
