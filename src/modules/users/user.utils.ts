import { FamilyMember, UserDocument, UserResponse } from "./user.interface";

export function buildFamilyMemberResponse(member: any): FamilyMember {
  const dob = new Date(member.dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return {
    id: member._id?.toString?.() ?? member.id?.toString?.(),
    name: member.name,
    dateOfBirth: member.dateOfBirth,
    age,
    relation: member.relation,
    gender: member.gender,
    bloodGroup: member.bloodGroup,
    mobileNumber: member.mobileNumber,
    photoUrl: member.photoUrl ?? null,
  };
}

export function buildUserResponse(user: UserDocument): UserResponse {
  return {
    id: (user._id as { toString(): string }).toString(),
    phone: user.phone ?? null,
    email: user.email ?? null,
    isEmailVerified: user.isEmailVerified ?? false,
    role: user.role,
    isPhoneVerified: user.isPhoneVerified,
    isActive: user.isActive,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    photoUrl: user.photoUrl ?? null,
    address: user.address,
    familyMembers: (user.familyMembers ?? []).map(buildFamilyMemberResponse),
    savedHospitals: user.savedHospitals,
    emergencyContact: user.emergencyContact,
    preferences: user.preferences,
    isRegistered: Boolean(user.firstName && user.dateOfBirth && user.gender),
    // Blood donor fields
    isDonor: user.isDonor ?? false,
    donorBloodGroup: user.donorBloodGroup ?? null,
    isAvailable: user.isAvailable ?? false,
    isContactVisible: user.isContactVisible ?? false,
    lastDonationDate: user.lastDonationDate ?? null,
    eligibilitySelfDeclared: user.eligibilitySelfDeclared ?? false,
    viewCount: user.viewCount ?? 0,
    donateCount: user.donateCount ?? 0,
    stopAsDonor: user.stopAsDonor ?? false,
    isDonorVerified: user.isDonorVerified ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
