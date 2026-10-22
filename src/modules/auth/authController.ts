import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { sendOtpEmail } from "../../integrations/emailAdapter";
import { AuthError, RateLimitError } from "../../shared/errors";
import { validated } from "../../middleware/validate";
import { findOrCreateUserByEmail } from "../users/user.service";
import { buildUserResponse } from "../users/user.utils";
import { UserModel } from "../users/user.schema";
import {
  clearOtp,
  getActiveOtp,
  getLockoutSeconds,
  getRequestCount,
  getResendCooldownSeconds,
  incrementLockoutCount,
  incrementOtpAttempts,
  incrementRequestCount,
  LONG_LOCK_SECONDS,
  MAX_LOCKOUTS_BEFORE_LONG,
  MAX_REQUESTS_PER_WINDOW,
  MAX_WRONG_ATTEMPTS,
  resetLockoutCount,
  setActiveOtp,
  setLockout,
  setResendCooldown,
  SHORT_LOCK_SECONDS,
} from "./otpStore";
import {
  issueTokens,
  revokeAllSessions,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";
import type {
  RefreshInput,
  SendOtpInput,
  VerifyOtpInput,
  LogoutInput,
  GoogleAuthInput,
} from "./auth.zod";

// Lazily initialised — only created when GOOGLE_CLIENT_ID is set
let _googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!_googleClient) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new AuthError("Google Sign-In is not configured", "GOOGLE_AUTH_FAILED");
    _googleClient = new OAuth2Client(clientId);
  }
  return _googleClient;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
  const { email } = validated<SendOtpInput>(req);

  const lockoutSeconds = await getLockoutSeconds(email);
  if (lockoutSeconds > 0) {
    throw new RateLimitError(
      "Too many wrong attempts. Try again later.",
      { retryAfterSeconds: lockoutSeconds },
    );
  }

  const cooldown = await getResendCooldownSeconds(email);
  if (cooldown > 0) {
    throw new RateLimitError(
      `Please wait ${cooldown}s before requesting another OTP`,
      { retryAfterSeconds: cooldown },
    );
  }

  const windowCount = await getRequestCount(email);
  if (windowCount >= MAX_REQUESTS_PER_WINDOW) {
    throw new RateLimitError(
      `Maximum ${MAX_REQUESTS_PER_WINDOW} OTP requests allowed per 15 minutes`,
      { retryAfterSeconds: 15 * 60 },
    );
  }

  const code = generateOtp();
  await setActiveOtp(email, code);
  await setResendCooldown(email);
  await incrementRequestCount(email);

  await sendOtpEmail(email, code);

  res.status(200).json({
    message: "OTP sent successfully",
  });
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const { email, otp } = validated<VerifyOtpInput>(req);

  const lockoutSeconds = await getLockoutSeconds(email);
  if (lockoutSeconds > 0) {
    throw new RateLimitError(
      "Too many wrong attempts. Try again later.",
      { retryAfterSeconds: lockoutSeconds },
    );
  }

  const stored = await getActiveOtp(email);
  if (!stored) {
    throw new AuthError("OTP expired or not requested. Please request a new one.", "OTP_NOT_FOUND");
  }

  if (stored.code !== otp) {
    const updated = await incrementOtpAttempts(email);
    const attempts = updated?.attempts ?? stored.attempts + 1;
    const attemptsRemaining = Math.max(0, MAX_WRONG_ATTEMPTS - attempts);

    if (attempts >= MAX_WRONG_ATTEMPTS) {
      const lockoutNumber = await incrementLockoutCount(email);
      const lockSeconds =
        lockoutNumber >= MAX_LOCKOUTS_BEFORE_LONG ? LONG_LOCK_SECONDS : SHORT_LOCK_SECONDS;
      await setLockout(email, lockSeconds);
      await clearOtp(email);
      throw new RateLimitError(
        "Too many wrong attempts. Account locked. Please try again later.",
        { retryAfterSeconds: lockSeconds, attemptsRemaining: 0 },
      );
    }

    throw new AuthError("Invalid OTP", "OTP_INVALID", { attemptsRemaining });
  }

  // Success: invalidate OTP, reset lockout escalation
  await clearOtp(email);
  await resetLockoutCount(email);

  const { user, isNewUser } = await findOrCreateUserByEmail(email);
  const tokens = await issueTokens(user.id, user.role);

  res.status(200).json({
    message: isNewUser ? "Signup successful" : "Login successful",
    user: buildUserResponse(user),
    isNewUser,
    requiresProfileCompletion: !buildUserResponse(user).isRegistered,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
  });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = validated<RefreshInput>(req);
  const decoded = verifyRefreshToken(refreshToken);
  const tokens = await rotateRefreshToken(
    refreshToken,
    (decoded as { role?: "user" | "content_admin" | "platform_admin" }).role ?? "user",
  );
  res.status(200).json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
  });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = validated<LogoutInput>(req);
  if (refreshToken) {
    try {
      await revokeRefreshToken(refreshToken);
    } catch {
      // Idempotent: invalid/expired tokens still respond 200.
    }
  }
  res.status(200).json({ message: "Logout successful" });
}

// Sanity helper for tests/dev — not wired into routes.
export const _internals = { verifyAccessToken };

export async function logoutAllHandler(req: Request, res: Response): Promise<void> {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    throw new AuthError("Missing or malformed Authorization header", "AUTH_REQUIRED");
  }
  const claims = verifyAccessToken(header.slice("bearer ".length).trim());
  await revokeAllSessions(claims.sub);
  res.status(200).json({ message: "Logout successful" });
}

export async function googleAuthHandler(req: Request, res: Response): Promise<void> {
  const { idToken } = validated<GoogleAuthInput>(req);

  // 1. Verify Google ID token
  let email: string;
  let googleId: string;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let photoUrl: string | undefined;

  try {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      throw new AuthError("Invalid Google token", "GOOGLE_AUTH_FAILED");
    }
    if (!payload.email) {
      throw new AuthError("Google account has no email", "GOOGLE_AUTH_FAILED");
    }

    email    = payload.email.toLowerCase().trim();
    googleId = payload.sub;

    // Extract profile info from Google payload for new users
    if (payload.name) {
      const parts = payload.name.trim().split(" ");
      firstName = parts[0];
      lastName  = parts.slice(1).join(" ") || undefined;
    }
    photoUrl = payload.picture ?? undefined;

  } catch (err: any) {
    // Re-throw AppErrors as-is, wrap all others
    if (err?.code === "GOOGLE_AUTH_FAILED" || err?.code === "AUTH_ERROR") throw err;
    throw new AuthError("Invalid Google token", "GOOGLE_AUTH_FAILED");
  }

  // 2. Find or create user by email (same as OTP flow)
  const { user, isNewUser } = await findOrCreateUserByEmail(email);

  // 3. Link googleId if not already set; also enrich profile for new users
  const updates: Record<string, unknown> = {};
  if (!user.googleId) updates.googleId = googleId;
  if (isNewUser) {
    if (firstName && !user.firstName) updates.firstName = firstName;
    if (lastName  && !user.lastName)  updates.lastName  = lastName;
    if (photoUrl  && !user.photoUrl)  updates.photoUrl  = photoUrl;
  }
  if (Object.keys(updates).length > 0) {
    await UserModel.findByIdAndUpdate(user._id, { $set: updates });
    // Apply updates to in-memory user so buildUserResponse reflects them
    Object.assign(user, updates);
  }

  // 4. Issue tokens — exactly like OTP flow
  const tokens = await issueTokens((user._id as any).toString(), user.role);
  const userResponse = buildUserResponse(user);

  res.status(200).json({
    message: isNewUser ? "Signup successful" : "Login successful",
    user: userResponse,
    isNewUser,
    requiresProfileCompletion: !userResponse.isRegistered,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresIn: tokens.refreshTokenExpiresIn,
  });
}
