import dotenv from "dotenv";
import { connectMongo } from "./db/mongoose";
import { connectRedis } from "./db/redis";
import { initMongoIndexes } from "./db/indexes";
import { createApp } from "./app";

dotenv.config();

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/user_configuration";
const REDIS_URL = process.env.REDIS_URL;

async function startServer(): Promise<void> {
  await connectMongo(MONGODB_URI);
  await initMongoIndexes();
  if (REDIS_URL) {
    await connectRedis(REDIS_URL);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server failed to start", error);
  process.exit(1);
});
