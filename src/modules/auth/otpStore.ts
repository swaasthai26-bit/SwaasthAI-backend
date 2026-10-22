import type Redis from "ioredis";
import { getRedisClient } from "../../db/redis";

// SRS §6.11 — all OTP state lives in Redis with explicit TTLs so the API
// remains stateless and horizontally scalable.
// Keys:
//   otp:{phone}          -> JSON { code, attempts, expiresAt }      TTL 5 min
//   otp:resend:{phone}   -> "1"                                     TTL 30 s
//   otp:rate:{phone}     -> integer counter                         TTL 15 min
//   otp:lockout:{phone}  -> "1"                                     TTL 30 s or 15 min
//   otp:lockcount:{phone}-> integer counter                         TTL 1 h

export const OTP_TTL_SECONDS = 5 * 60;
export const RESEND_COOLDOWN_SECONDS = 30;
export const RATE_WINDOW_SECONDS = 15 * 60;
export const MAX_REQUESTS_PER_WINDOW = 5;
export const MAX_WRONG_ATTEMPTS = 3;
export const SHORT_LOCK_SECONDS = 30;
export const LONG_LOCK_SECONDS = 15 * 60;
export const LOCK_COUNT_WINDOW_SECONDS = 60 * 60;
export const MAX_LOCKOUTS_BEFORE_LONG = 3;

export interface StoredOtp {
  code: string;
  attempts: number;
  expiresAt: number;
}

function key(prefix: string, phone: string): string {
  return `${prefix}:${phone}`;
}

function getClient(): Redis {
  const client = getRedisClient();
  if (!client) {
    throw new Error("Redis client not initialized. Set REDIS_URL.");
  }
  return client;
}

export async function getActiveOtp(phone: string): Promise<StoredOtp | null> {
  const raw = await getClient().get(key("otp", phone));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOtp;
  } catch {
    return null;
  }
}

export async function setActiveOtp(phone: string, code: string): Promise<StoredOtp> {
  const payload: StoredOtp = {
    code,
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  await getClient().set(key("otp", phone), JSON.stringify(payload), "EX", OTP_TTL_SECONDS);
  return payload;
}

export async function clearOtp(phone: string): Promise<void> {
  await getClient().del(key("otp", phone));
}

export async function incrementOtpAttempts(phone: string): Promise<StoredOtp | null> {
  const otp = await getActiveOtp(phone);
  if (!otp) return null;
  otp.attempts += 1;
  const ttl = Math.max(1, Math.floor((otp.expiresAt - Date.now()) / 1000));
  await getClient().set(key("otp", phone), JSON.stringify(otp), "EX", ttl);
  return otp;
}

export async function getResendCooldownSeconds(phone: string): Promise<number> {
  const ttl = await getClient().ttl(key("otp:resend", phone));
  return ttl > 0 ? ttl : 0;
}

export async function setResendCooldown(phone: string): Promise<void> {
  await getClient().set(key("otp:resend", phone), "1", "EX", RESEND_COOLDOWN_SECONDS);
}

export async function incrementRequestCount(phone: string): Promise<number> {
  const client = getClient();
  const k = key("otp:rate", phone);
  const count = await client.incr(k);
  if (count === 1) {
    await client.expire(k, RATE_WINDOW_SECONDS);
  }
  return count;
}

export async function getRequestCount(phone: string): Promise<number> {
  const raw = await getClient().get(key("otp:rate", phone));
  return raw ? Number(raw) : 0;
}

export async function getLockoutSeconds(phone: string): Promise<number> {
  const ttl = await getClient().ttl(key("otp:lockout", phone));
  return ttl > 0 ? ttl : 0;
}

export async function setLockout(phone: string, seconds: number): Promise<void> {
  await getClient().set(key("otp:lockout", phone), "1", "EX", seconds);
}

export async function incrementLockoutCount(phone: string): Promise<number> {
  const client = getClient();
  const k = key("otp:lockcount", phone);
  const count = await client.incr(k);
  if (count === 1) {
    await client.expire(k, LOCK_COUNT_WINDOW_SECONDS);
  }
  return count;
}

export async function resetLockoutCount(phone: string): Promise<void> {
  await getClient().del(key("otp:lockcount", phone));
}
