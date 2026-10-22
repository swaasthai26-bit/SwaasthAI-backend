import type { Response } from "express";
import { z } from "zod";
import { sendOtpSms } from "../../integrations/smsAdapter";
import { validated } from "../../middleware/validate";
import { AuthError, ConflictError, RateLimitError } from "../../shared/errors";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { indianPhoneSchema, otpCodeSchema } from "../auth/auth.zod";
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
} from "../auth/otpStore";
import { UserModel } from "./user.schema";
import {
  addFamilyMember,
  deleteFamilyMemberPhoto,
  deleteFamilyMember,
  deleteMyPhoto,
  deleteMe,
  getFamilyMembers,
  getMe,
  registerFcmToken,
  saveHospital,
  unsaveHospital,
  unregisterFcmToken,
  updateFamilyMember,
  updateMe,
  updatePreferences,
} from "./user.service";
import { buildFamilyMemberResponse, buildUserResponse } from "./user.utils";
import {
  FamilyMemberSchema,
  FcmTokenSchema,
  PreferencesSchema,
  type UpdateMeInput,
} from "./user.zod";

const changePhoneSendSchema = z
  .object({
    newPhone: indianPhoneSchema,
    deviceId: z.string().trim().max(128).optional(),
  })
  .strict();

const changePhoneVerifySchema = z
  .object({
    newPhone: indianPhoneSchema,
    otp: otpCodeSchema,
  })
  .strict();

function generateOtp(): string {
  // return Math.floor(100000 + Math.random() * 900000).toString();
  return "123456";
}

export async function getMeHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const user = await getMe(req.user.id);
  res.status(200).json(buildUserResponse(user));
}

export async function getFamilyMembersHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const familyMembers = await getFamilyMembers(req.user.id);
  res.status(200).json({ data: familyMembers.map(buildFamilyMemberResponse) });
}

export async function updateMeHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const input = validated<UpdateMeInput>(req);
  const user = await updateMe(req.user.id, input);
  res.status(200).json(buildUserResponse(user));
}

export async function deleteMeHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  await deleteMe(req.user.id);
  res.status(200).json({ message: "User deleted successfully" });
}

export async function deleteMyPhotoHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res.status(200).json(buildUserResponse(await deleteMyPhoto(req.user.id)));
}

export async function addFamilyMemberHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const input = FamilyMemberSchema.parse(req.body);
  const user = await addFamilyMember(req.user.id, input);
  res.status(200).json({ message: "Member added successfully", ...buildUserResponse(user) });
}

export async function updateFamilyMemberHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const input = FamilyMemberSchema.partial().parse(req.body);
  const user = await updateFamilyMember(req.user.id, req.params.id as string, input);
  res.json({ message: "Member updated successfully", ...buildUserResponse(user) });
}

export async function deleteFamilyMemberHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const user = await deleteFamilyMember(req.user.id, req.params.id as string);
  res.json({ message: "Member deleted successfully", ...buildUserResponse(user) });
}

export async function deleteFamilyMemberPhotoHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res.json(
    buildUserResponse(
      await deleteFamilyMemberPhoto(req.user.id, req.params.id as string),
    ),
  );
}

export async function saveHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res
    .status(200)
    .json(
      buildUserResponse(
        await saveHospital(req.user.id, req.params.id as string),
      ),
    );
}

export async function unsaveHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res.json(
    buildUserResponse(
      await unsaveHospital(req.user.id, req.params.id as string),
    ),
  );
}

export async function updatePreferencesHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const input = PreferencesSchema.parse(req.body);
  res.json(buildUserResponse(await updatePreferences(req.user.id, input)));
}

export async function registerFcmTokenHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const input = FcmTokenSchema.parse(req.body);
  res
    .status(200)
    .json(buildUserResponse(await registerFcmToken(req.user.id, input)));
}

export async function unregisterFcmTokenHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res.json(
    buildUserResponse(
      await unregisterFcmToken(req.user.id, req.params.deviceId as string),
    ),
  );
}

export async function sendChangePhoneOtpHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const { newPhone } = changePhoneSendSchema.parse(req.body);
  const existing = await UserModel.findOne({
    phone: newPhone,
    deletedAt: null,
  });
  if (existing && existing._id.toString() !== req.user.id) {
    throw new ConflictError(
      "Phone number is already registered",
      "PHONE_ALREADY_REGISTERED",
    );
  }

  const lockoutSeconds = await getLockoutSeconds(newPhone);
  if (lockoutSeconds > 0) {
    throw new RateLimitError("Too many wrong attempts. Try again later.", {
      retryAfterSeconds: lockoutSeconds,
    });
  }
  const cooldown = await getResendCooldownSeconds(newPhone);
  if (cooldown > 0) {
    throw new RateLimitError(
      `Please wait ${cooldown}s before requesting another OTP`,
      {
        retryAfterSeconds: cooldown,
      },
    );
  }
  const windowCount = await getRequestCount(newPhone);
  if (windowCount >= MAX_REQUESTS_PER_WINDOW) {
    throw new RateLimitError(
      `Maximum ${MAX_REQUESTS_PER_WINDOW} OTP requests allowed per 15 minutes`,
      { retryAfterSeconds: 15 * 60 },
    );
  }

  const code = generateOtp();
  await setActiveOtp(newPhone, code);
  await setResendCooldown(newPhone);
  await incrementRequestCount(newPhone);
  await sendOtpSms(newPhone, code);

  res.status(200).json({
    message: "OTP sent successfully",
  });
}

export async function verifyChangePhoneOtpHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user)
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  const { newPhone, otp } = changePhoneVerifySchema.parse(req.body);

  const lockoutSeconds = await getLockoutSeconds(newPhone);
  if (lockoutSeconds > 0) {
    throw new RateLimitError("Too many wrong attempts. Try again later.", {
      retryAfterSeconds: lockoutSeconds,
    });
  }
  const stored = await getActiveOtp(newPhone);
  if (!stored) {
    throw new AuthError(
      "OTP expired or not requested. Please request a new one.",
      "OTP_NOT_FOUND",
    );
  }
  if (stored.code !== otp) {
    const updated = await incrementOtpAttempts(newPhone);
    const attempts = updated?.attempts ?? stored.attempts + 1;
    if (attempts >= MAX_WRONG_ATTEMPTS) {
      const lockoutNumber = await incrementLockoutCount(newPhone);
      const lockSeconds =
        lockoutNumber >= MAX_LOCKOUTS_BEFORE_LONG
          ? LONG_LOCK_SECONDS
          : SHORT_LOCK_SECONDS;
      await setLockout(newPhone, lockSeconds);
      await clearOtp(newPhone);
      throw new RateLimitError(
        "Too many wrong attempts. Account locked. Please try again later.",
        {
          retryAfterSeconds: lockSeconds,
          attemptsRemaining: 0,
        },
      );
    }
    throw new AuthError("Invalid OTP", "OTP_INVALID", {
      attemptsRemaining: Math.max(0, MAX_WRONG_ATTEMPTS - attempts),
    });
  }

  await clearOtp(newPhone);
  await resetLockoutCount(newPhone);
  const user = await UserModel.findByIdAndUpdate(
    req.user.id,
    { phone: newPhone, isPhoneVerified: true },
    { new: true },
  );
  if (!user) throw new AuthError("Authentication required", "AUTH_REQUIRED");
  res.json(buildUserResponse(user));
}
