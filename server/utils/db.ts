import { MongoClient, Db } from 'mongodb';
import type { H3Event } from 'h3';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export const useDB = async (event?: H3Event): Promise<Db> => {
  const config = useRuntimeConfig(event);
  const uri = (config.mongodbUri as string)
    || (event as any)?.context?.cloudflare?.env?.MONGODB_URI
    || process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is missing');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  // In Cloudflare Workers, we use a global singleton to reuse the connection pool.
  // We use clientPromise to ensure multiple simultaneous requests don't start multiple connections.
  if (!clientPromise) {
    client = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });
    clientPromise = client.connect();
  }


  try {
    const connectedClient = await clientPromise;
    return connectedClient.db();
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    // Reset promise on error so next request can retry
    clientPromise = null;
    throw createError({
      statusCode: 500,
      statusMessage: 'Database connection failed',
    });
  }
};
