import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    return;
  }
  
  const config = useRuntimeConfig();
  if (!config.mongodbUri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
  }

  try {
    const db = await mongoose.connect(config.mongodbUri);
    isConnected = db.connection.readyState === 1;
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};
