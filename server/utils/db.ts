import { MongoClient, Db } from 'mongodb';
import type { H3Event } from 'h3';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export const useDB = async (event?: H3Event): Promise<Db> => {
  // If the client exists but was closed, reset everything
  if (client && (client as any).topology?.s?.state === 'closed') {
    client = null;
    dbInstance = null;
  }

  if (dbInstance) return dbInstance;

  const config = useRuntimeConfig(event);
  const uri = config.mongodbUri as string || (event as any)?.context?.cloudflare?.env?.MONGODB_URI || process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('MONGODB_URI is missing');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  try {
    if (!client) {
      client = new MongoClient(uri, {
        // Optimizing for serverless/Edge environments
        maxPoolSize: 1,
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
      });
      await client.connect();
      console.log('Connected to MongoDB');
    }
    dbInstance = client.db();
    return dbInstance;
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    // Reset on failure so the next attempt starts fresh
    client = null;
    dbInstance = null;
    throw createError({ 
      statusCode: 500, 
      statusMessage: 'Database connection failed' 
    });
  }
};
