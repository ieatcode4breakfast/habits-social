import { MongoClient, Db } from 'mongodb';
import type { H3Event } from 'h3';

export const useDB = async (event?: H3Event): Promise<Db> => {
  const config = useRuntimeConfig(event);
  const uri = (config.mongodbUri as string)
    || (event as any)?.context?.cloudflare?.env?.MONGODB_URI
    || process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is missing');
    throw createError({ statusCode: 500, statusMessage: 'Database configuration missing' });
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    });
    await client.connect();
    return client.db();
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Database connection failed',
    });
  }
};
