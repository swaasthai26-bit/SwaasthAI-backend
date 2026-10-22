import { Document, Types } from "mongoose";

export type HospitalStatus = "pending" | "active" | "suspended" | "closed";

export interface Location {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface DayTiming {
  open: string; // HH:MM format
  close: string; // HH:MM format
  isClosed?: boolean;
}

export interface Timings {
  mon: DayTiming;
  tue: DayTiming;
  wed: DayTiming;
  thu: DayTiming;
  fri: DayTiming;
  sat: DayTiming;
  sun: DayTiming;
}

export interface Photo {
  url: string;
  caption?: string;
  order?: number;
}

export interface LocalizedName {
  hi?: string;
  or?: string;
}

export interface Rating {
  avg: number;
  count: number;
}

export interface HospitalDocument extends Document {
  name: string;
  localizedName?: LocalizedName;
  slug: string;
  description?: string;
  location: Location;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  whatsappNumber?: string | null;
  contactPhone: string;
  contactEmail: string;
  specializations: string[];
  amenities: string[];
  photos: Photo[];
  timings: Timings;
  holidays: Date[];
  acceptedInsurancePlans: string[];
  startingConsultationFee: number;
  rating: Rating;
  status: HospitalStatus;
  isVerified: boolean;
  verifiedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HospitalResponse {
  id: string;
  name: string;
  localizedName?: LocalizedName;
  slug: string;
  description?: string;
  location: Location;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  whatsappNumber?: string | null;
  contactPhone: string;
  contactEmail: string;
  specializations: string[];
  amenities: string[];
  photos: Photo[];
  timings: Timings;
  holidays: Date[];
  acceptedInsurancePlans: string[];
  startingConsultationFee: number;
  rating: Rating;
  status: HospitalStatus;
  isVerified: boolean;
  verifiedAt?: Date | null;
  distanceKm?: number;
  isOpenNow?: boolean;
  hasWhatsApp: boolean;
  hasCashless: boolean;
  thumbnail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQuery {
  lat?: number;
  lng?: number;
  radius?: number; // km, default 10, max 50
  specialization?: string[];
  minRating?: number;
  hasCashless?: boolean;
  city?: string;
  pincode?: string;
  minFee?: number;
  maxFee?: number;
  acceptedInsurancePlan?: string;
  insurerName?: string; // filter by insurer name e.g. "Star Health"
  openNow?: boolean;
  q?: string; // search text
  sort?: "distance" | "rating" | "fee" | "fee_desc" | "popularity" | "cashless";
  gender?: "male" | "female" | "other";
  availableDate?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}
