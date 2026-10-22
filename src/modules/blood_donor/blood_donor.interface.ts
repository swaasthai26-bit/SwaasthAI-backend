import type { Document, Types } from "mongoose";
import type { BLOOD_GROUPS } from "./blood_donor.constants";

export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export type BloodDonorSource = "self_registered" | "admin_imported";

export interface GeoLocation {
  type: "Point";
  coordinates: [number, number];
}

export interface ContactCount {
  today: number;
  thisWeek: number;
  total: number;
}

export interface BloodDonorDocument extends Document {
  userId?: Types.ObjectId | null;
  name: string;
  phone: string;
  bloodGroup: BloodGroup;
  city: string;
  state?: string;
  pincode?: string;
  location: GeoLocation;
  lastDonationDate?: Date | null;
  lastAvailableAt?: Date | null;
  isAvailable: boolean;
  isPhoneVerified: boolean;
  isVerified: boolean;
  eligibilitySelfDeclared: boolean;
  eligibilityDeclaredAt?: Date | null;
  source: BloodDonorSource;
  contactCount: ContactCount;
  rating: number;
  complaints: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicDonorSummary {
  id: string;
  firstName: string;
  bloodGroup: BloodGroup;
  city: string;
  lastDonationDate: Date | null;
  lastAvailableAt: Date | null;
  daysSinceLastDonation: number | null;
  mayBeEligible: boolean;
  distanceKm?: number;
  isVerified: boolean;
  isAvailable: boolean;
}
