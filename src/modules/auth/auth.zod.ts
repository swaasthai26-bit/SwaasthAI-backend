import { z } from "zod";

// Still used by user.controller.ts (changePhone flow) — do NOT remove.
export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+91[6-9]\d{9}$/,
    "Phone must be in +91XXXXXXXXXX format (Indian mobile)",
  );

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "OTP must be exactly 6 digits");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

export const deviceInfoSchema = z
  .object({
    deviceId: z.string().trim().min(1).max(128),
    platform: z.enum(["android", "ios", "web"]).optional(),
    model: z.string().trim().max(64).optional(),
    osVersion: z.string().trim().max(32).optional(),
    appVersion: z.string().trim().max(32).optional(),
  })
  .strict();

// Auth: login / register via email OTP
export const sendOtpSchema = z
  .object({
    email: emailSchema,
    deviceId: z.string().trim().max(128).optional(),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    email: emailSchema,
    otp: otpCodeSchema,
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(20),
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(20).optional(),
  })
  .strict();

export const googleAuthSchema = z
  .object({
    idToken: z.string().min(10, "idToken is required"),
  })
  .strict();

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
