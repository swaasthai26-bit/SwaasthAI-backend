import Redis from 'ioredis';

let redisClient: Redis | null = null;

export async function connectRedis(url: string): Promise<Redis> {
  if (redisClient) {
    return redisClient;
  }

  if (url === 'mock') {
    const RedisMock = require('ioredis-mock');
    redisClient = new RedisMock() as unknown as Redis;
    console.log('Connected to Mock Redis (in-memory)');
    return redisClient;
  }

  redisClient = new Redis(url);

  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });

  redisClient.on('error', (error) => {
    console.error('Redis connection error', error);
  });

  await redisClient.ping();
  return redisClient;
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

/** Test-only seam: inject an in-memory client (e.g. ioredis-mock). */
export function setRedisClient(client: Redis | null): void {
  redisClient = client;
}
