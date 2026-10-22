import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors";
import { UserDocument } from "./user.interface";
import {
  createUserWithEmail,
  createUserWithPhone,
  findUserById,
  findUserByEmail,
  findUserByPhone,
  softDeleteUser,
  updateUserById,
} from "./user.repository";
import { HospitalModel } from "../hospitals/hospital.schema";
import type {
  FamilyMemberInput,
  FcmTokenInput,
  PreferencesInput,
  UpdateMeInput,
} from "./user.zod";
import { geocodeIndianLocation } from "../blood_donor/blood_donor.utils";

export interface FindOrCreateResult {
  user: UserDocument;
  isNewUser: boolean;
}

export async function findOrCreateUserByPhone(phone: string): Promise<FindOrCreateResult> {
  const existing = await findUserByPhone(phone);
  if (existing) {
    if (!existing.isActive) {
      throw new ConflictError("Account is suspended", "ACCOUNT_SUSPENDED");
    }
    if (!existing.isPhoneVerified) {
      existing.isPhoneVerified = true;
      await existing.save();
    }
    return { user: existing, isNewUser: false };
  }
  const created = await createUserWithPhone(phone);
  return { user: created, isNewUser: true };
}

export async function findOrCreateUserByEmail(email: string): Promise<FindOrCreateResult> {
  const normalised = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalised);
  if (existing) {
    if (!existing.isActive) {
      throw new ConflictError("Account is suspended", "ACCOUNT_SUSPENDED");
    }
    if (!existing.isEmailVerified) {
      existing.isEmailVerified = true;
      await existing.save();
    }
    return { user: existing, isNewUser: false };
  }
  const created = await createUserWithEmail(normalised);
  return { user: created, isNewUser: true };
}

export async function getMe(userId: string): Promise<UserDocument> {
  const user = await findUserById(userId);
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function getFamilyMembers(userId: string) {
  const user = await getMe(userId);
  return user.familyMembers ?? [];
}

export async function updateMe(
  userId: string,
  input: UpdateMeInput,
): Promise<UserDocument> {
  const { dateOfBirth, dpdpConsentAccepted, donor, ...rest } = input;
  const update: Record<string, any> = { ...rest };
  if (dateOfBirth) {
    update.dateOfBirth = new Date(dateOfBirth);
  }
  if (dpdpConsentAccepted) update.dpdpConsentAt = new Date();

  // --- Donor enrollment / unregistration ---
  if (donor !== undefined) {
    const user = await findUserById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (donor.isDonor === true) {
      // Registering as donor
      if (user.isDonor) throw new ConflictError("You are already registered as a donor");

      // Age check — only if DOB is already set or being set in this request
      const dob = dateOfBirth ? new Date(dateOfBirth) : user.dateOfBirth;
      if (dob && getAge(dob) < 18) {
        throw new ForbiddenError("Blood donors must be at least 18 years old");
      }

      // Resolve city/pincode — from donor sub-object or fall back to profile address
      const city = donor.donorCity ?? user.address?.city;
      const pincode = donor.donorPincode ?? user.address?.pincode;

      update.isDonor = true;
      update.donorBloodGroup = donor.donorBloodGroup;
      update.isAvailable = donor.isAvailable ?? true;
      update.isContactVisible = false;
      update.lastDonationDate = donor.lastDonationDate ?? null;
      update.eligibilitySelfDeclared = true;
      update.viewCount = 0;
      update.donateCount = 0;
      update.stopAsDonor = false;
      if (city) update["address.city"] = city;
      if (pincode) update["address.pincode"] = pincode;

    } else {
      // Unregistering as donor
      if (!user.isDonor) throw new NotFoundError("Donor profile not found");
      update.isDonor = false;
      update.isAvailable = false;
      update.stopAsDonor = false;
      update.donorBloodGroup = null;
      update.eligibilitySelfDeclared = false;
    }
  }

  const updated = await updateUserById(userId, update);
  if (!updated) throw new NotFoundError("User not found");
  return updated;
}

export async function deleteMyPhoto(userId: string): Promise<UserDocument> {
  const user = await updateUserById(userId, { $unset: { photoUrl: "" } });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function deleteMe(userId: string): Promise<void> {
  const user = await softDeleteUser(userId);
  if (!user) throw new NotFoundError("User not found");
}

export async function addFamilyMember(
  userId: string,
  input: FamilyMemberInput,
): Promise<UserDocument> {
  const user = await getMe(userId);
  if ((user.familyMembers ?? []).length >= 5) {
    throw new ConflictError("A user can have up to 5 family members");
  }
  if (input.mobileNumber && input.mobileNumber === user.phone) {
    throw new ConflictError(
      "You cannot add your own login number as a family member's phone",
      "OWN_PHONE_NOT_ALLOWED",
    );
  }
  if (input.mobileNumber) {
    const duplicate = (user.familyMembers ?? []).some(
      (m: any) => m.mobileNumber === input.mobileNumber,
    );
    if (duplicate) {
      throw new ConflictError(
        "This phone number is already used by another family member",
        "DUPLICATE_PHONE",
      );
    }
  }
  user.familyMembers = [
    ...(user.familyMembers ?? []),
    { ...input, dateOfBirth: new Date(input.dateOfBirth) },
  ] as any;
  return user.save();
}

export async function updateFamilyMember(
  userId: string,
  memberId: string,
  input: Partial<FamilyMemberInput>,
): Promise<UserDocument> {
  const user = await getMe(userId);
  if (input.mobileNumber && input.mobileNumber === user.phone) {
    throw new ConflictError(
      "You cannot use your own login number as a family member's phone",
      "OWN_PHONE_NOT_ALLOWED",
    );
  }
  if (input.mobileNumber) {
    const duplicate = (user.familyMembers ?? []).some(
      (m: any) => m.mobileNumber === input.mobileNumber && m._id?.toString() !== memberId,
    );
    if (duplicate) {
      throw new ConflictError(
        "This phone number is already used by another family member",
        "DUPLICATE_PHONE",
      );
    }
  }
  const member = (user.familyMembers as any)?.id(memberId);
  if (!member) throw new NotFoundError("Family member not found");
  Object.assign(
    member,
    input,
    input.dateOfBirth ? { dateOfBirth: new Date(input.dateOfBirth) } : {},
  );
  return user.save();
}

export async function deleteFamilyMemberPhoto(
  userId: string,
  memberId: string,
): Promise<UserDocument> {
  const user = await getMe(userId);
  const member = (user.familyMembers as any)?.id(memberId);
  if (!member) throw new NotFoundError("Family member not found");
  member.photoUrl = undefined;
  return user.save();
}

export async function deleteFamilyMember(
  userId: string,
  memberId: string,
): Promise<UserDocument> {
  const user = await getMe(userId);
  const member = (user.familyMembers as any)?.id(memberId);
  if (!member) throw new NotFoundError("Family member not found");
  member.deleteOne();
  return user.save();
}

export async function saveHospital(
  userId: string,
  hospitalId: string,
): Promise<UserDocument> {
  const hospital = await HospitalModel.findOne({ _id: hospitalId, deletedAt: null });
  if (!hospital) throw new NotFoundError("Hospital not found");
  const user = await updateUserById(userId, {
    $addToSet: { savedHospitals: hospitalId },
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function unsaveHospital(
  userId: string,
  hospitalId: string,
): Promise<UserDocument> {
  const user = await updateUserById(userId, {
    $pull: { savedHospitals: hospitalId },
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function updatePreferences(
  userId: string,
  input: PreferencesInput,
): Promise<UserDocument> {
  const user = await updateUserById(userId, { preferences: input });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function registerFcmToken(
  userId: string,
  input: FcmTokenInput,
): Promise<UserDocument> {
  const user = await getMe(userId);
  user.fcmTokens = [
    ...(user.fcmTokens ?? []).filter((token) => token.deviceId !== input.deviceId),
    { ...input, lastUsedAt: new Date() },
  ];
  return user.save();
}

export async function unregisterFcmToken(
  userId: string,
  deviceId: string,
): Promise<UserDocument> {
  const user = await getMe(userId);
  user.fcmTokens = (user.fcmTokens ?? []).filter((token) => token.deviceId !== deviceId);
  return user.save();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAge(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age--;
  return age;
}
