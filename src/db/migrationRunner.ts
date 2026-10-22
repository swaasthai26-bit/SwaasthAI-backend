import dotenv from 'dotenv';
import { connectMongo } from './mongoose';
import { initMongoIndexes } from './indexes';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/user_configuration';

async function runMigrations(): Promise<void> {
  await connectMongo(MONGODB_URI);
  await initMongoIndexes();
  console.log('Migration runner completed');
}

runMigrations().catch((error) => {
  console.error('Migration runner failed', error);
  process.exit(1);
});
