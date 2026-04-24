import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

export const useDB = async (): Promise<Db> => {
  if (dbInstance) return dbInstance;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables.');

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
    throw error;
  }
};
