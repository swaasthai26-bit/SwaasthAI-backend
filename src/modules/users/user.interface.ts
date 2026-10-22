import { Document } from "mongoose";

export type Gender = "male" | "female" | "other";
export type UserRole = "user" | "content_admin" | "platform_admin";

export interface Location {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface Address {
  line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: Location;
}

export interface RecentlyViewedItem {
  type: "hospital" | "doctor";
  refId: string;
  viewedAt: Date;
}

export interface FamilyMember {
  id?: string;
  name: string;
  dateOfBirth: Date;
  age: number;
  relation: string;
  gender: Gender;
  bloodGroup?: string;
  mobileNumber?: string;
  photoUrl?: string | null;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface UserPreferences {
  language?: string;
  theme?: "light" | "dark" | "system";
  notifications?: boolean;
}

export interface FcmToken {
  token: string;
  deviceId: string;
  platform?: "android" | "ios" | "web";
  lastUsedAt: Date;
}

export interface UserPayload {
  firstName: string;
  lastName: string;
  dateOfBirth: string | Date;
  gender: Gender;
}

export interface UserDocument extends Document {
  phone?: string | null;
  email?: string | null;
  googleId?: string | null;
  isEmailVerified: boolean;
  role: UserRole;
  isPhoneVerified: boolean;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  photoUrl?: string | null;
  address?: Address;
  familyMembers?: FamilyMember[];
  savedHospitals?: string[];
  emergencyContact?: EmergencyContact;
  preferences?: UserPreferences;
  fcmTokens?: FcmToken[];
  recentlyViewed?: RecentlyViewedItem[];
  dpdpConsentAt?: Date;
  // Blood donor fields
  isDonor?: boolean;
  donorBloodGroup?: string | null;
  isAvailable?: boolean;
  isContactVisible?: boolean;
  lastDonationDate?: Date | null;
  eligibilitySelfDeclared?: boolean;
  viewCount?: number;
  donateCount?: number;
  stopAsDonor?: boolean;
  isDonorVerified?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponse {
  id: string;
  phone?: string | null;
  email?: string | null;
  isEmailVerified: boolean;
  role: UserRole;
  isPhoneVerified: boolean;
  isActive: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  photoUrl?: string | null;
  address?: Address;
  familyMembers?: FamilyMember[];
  savedHospitals?: string[];
  emergencyContact?: EmergencyContact;
  preferences?: UserPreferences;
  isRegistered: boolean;
  // Blood donor fields
  isDonor?: boolean;
  donorBloodGroup?: string | null;
  isAvailable?: boolean;
  isContactVisible?: boolean;
  lastDonationDate?: Date | null;
  eligibilitySelfDeclared?: boolean;
  viewCount?: number;
  donateCount?: number;
  stopAsDonor?: boolean;
  isDonorVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
