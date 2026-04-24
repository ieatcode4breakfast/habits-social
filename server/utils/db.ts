import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;
  const config = useRuntimeConfig();
  const uri = config.mongodbUri as string;
  if (!uri) throw new Error('MONGODB_URI is not set');

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      autoIndex: false,
    });
    isConnected = true;
    console.log('Successfully connected to MongoDB.');
  } catch (err: any) {
    console.error('MongoDB connection error:', err.message);
    throw createError({
      statusCode: 500,
      statusMessage: 'Database connection failed. Please check your terminal logs.',
    });
  }
};
