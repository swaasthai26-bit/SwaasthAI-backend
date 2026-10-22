import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { AuthError } from "../../shared/errors";
import { getRedisClient } from "../../db/redis";
import type { UserRole } from "../users/user.interface";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me";
const ACCESS_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 45 * 24 * 60 * 60);
const REFRESH_TTL_SECONDS = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 7 * 24 * 60 * 60);

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in production");
  }
}

export interface AccessTokenClaims extends JwtPayload {
  sub: string;
  role: UserRole;
  type: "access";
}

export interface RefreshTokenClaims extends JwtPayload {
  sub: string;
  jti: string;
  deviceId?: string;
  type: "refresh";
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

function sessionKey(userId: string, jti: string): string {
  return `session:${userId}:${jti}`;
}

function blacklistKey(jti: string): string {
  return `blacklist:token:${jti}`;
}

export async function issueTokens(
  userId: string,
  role: UserRole,
  deviceId?: string,
): Promise<IssuedTokens> {
  const jti = randomUUID();
  const accessOptions: SignOptions = { expiresIn: ACCESS_TTL_SECONDS };
  const refreshOptions: SignOptions = { expiresIn: REFRESH_TTL_SECONDS, jwtid: jti };

  const accessToken = jwt.sign(
    { sub: userId, role, type: "access" } satisfies AccessTokenClaims,
    ACCESS_SECRET,
    accessOptions,
  );
  const refreshToken = jwt.sign(
    { sub: userId, deviceId, type: "refresh" } satisfies Omit<RefreshTokenClaims, "jti">,
    REFRESH_SECRET,
    refreshOptions,
  );

  const redis = getRedisClient();
  if (redis) {
    await redis.set(sessionKey(userId, jti), deviceId ?? "", "EX", REFRESH_TTL_SECONDS);
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    refreshTokenExpiresIn: REFRESH_TTL_SECONDS,
  };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as AccessTokenClaims;
    if (decoded.type !== "access") {
      throw new AuthError("Wrong token type", "INVALID_TOKEN");
    }
    return decoded;
  } catch (err: any) {
    if (err instanceof AuthError) throw err;
    if (err && err.name === "TokenExpiredError") {
      throw new AuthError("Access token expired", "TOKEN_EXPIRED");
    }
    throw new AuthError("Invalid access token", "INVALID_TOKEN");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as RefreshTokenClaims;
    if (decoded.type !== "refresh") {
      throw new AuthError("Wrong token type", "INVALID_TOKEN");
    }
    if (!decoded.jti) {
      throw new AuthError("Refresh token missing jti", "INVALID_TOKEN");
    }
    return decoded;
  } catch (err: any) {
    if (err instanceof AuthError) throw err;
    if (err && err.name === "TokenExpiredError") {
      throw new AuthError("Refresh token expired", "TOKEN_EXPIRED");
    }
    throw new AuthError("Invalid refresh token", "INVALID_TOKEN");
  }
}

export async function rotateRefreshToken(
  oldToken: string,
  role: UserRole,
): Promise<IssuedTokens> {
  const claims = verifyRefreshToken(oldToken);
  const redis = getRedisClient();

  if (redis) {
    const isBlacklisted = await redis.get(blacklistKey(claims.jti));
    if (isBlacklisted) {
      // Reuse detected — wipe every session this user has (SRS FR-1.6 / EC-1.5).
      await revokeAllSessions(claims.sub);
      throw new AuthError("Refresh token reuse detected; all sessions revoked", "TOKEN_REUSED");
    }
    const sessionExists = await redis.exists(sessionKey(claims.sub, claims.jti));
    if (!sessionExists) {
      throw new AuthError("Session not found", "INVALID_TOKEN");
    }

    // Blacklist the old jti for its remaining lifetime, then drop the session.
    const ttl = Math.max(1, (claims.exp ?? 0) - Math.floor(Date.now() / 1000));
    await redis.set(blacklistKey(claims.jti), "1", "EX", ttl);
    await redis.del(sessionKey(claims.sub, claims.jti));
  }

  return issueTokens(claims.sub, role, claims.deviceId);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const claims = verifyRefreshToken(token);
  const redis = getRedisClient();
  if (!redis) return;
  const ttl = Math.max(1, (claims.exp ?? 0) - Math.floor(Date.now() / 1000));
  await redis.set(blacklistKey(claims.jti), "1", "EX", ttl);
  await redis.del(sessionKey(claims.sub, claims.jti));
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const pattern = `session:${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
