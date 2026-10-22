import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import RedisMock from "ioredis-mock";
import type Redis from "ioredis";
import { setRedisClient } from "../src/db/redis";
import { UserModel } from "../src/modules/users/user.schema";

let mongoServer: MongoMemoryServer | null = null;
let redisMock: InstanceType<typeof RedisMock> | null = null;

export async function startTestInfra(): Promise<void> {
  if (!process.env.JWT_ACCESS_SECRET) process.env.JWT_ACCESS_SECRET = "test-access-secret";
  if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await UserModel.createIndexes();

  redisMock = new RedisMock();
  setRedisClient(redisMock as unknown as Redis);
}

export async function stopTestInfra(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (redisMock) await redisMock.quit();
  setRedisClient(null);
}

export async function resetTestState(): Promise<void> {
  await UserModel.deleteMany({});
  if (redisMock) await redisMock.flushall();
}
