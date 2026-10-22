import mongoose from 'mongoose';

export async function connectMongo(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed', error);
    throw error;
  }
}

export async function closeMongo(): Promise<void> {
  await mongoose.disconnect();
}
