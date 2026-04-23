import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) return;
  const config = useRuntimeConfig();
  const uri = config.mongodbUri as string;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  isConnected = true;
};
