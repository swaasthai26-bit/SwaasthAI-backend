import { Document, Types } from "mongoose";

export interface HospitalAffiliation {
  hospitalId: Types.ObjectId;
  consultationFee: number;
  isPrimary: boolean;
  joinedAt: Date;
}

export interface Availability {
  hospitalId: Types.ObjectId;
  dayOfWeek:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface Rating {
  avg: number;
  count: number;
}

export interface DoctorDocument extends Document {
  name: string;
  photoUrl?: string;
  qualification: string;
  primarySpecialization: string;
  languages?: string[];
  experienceYears?: number;
  registrationNumber: string;
  bio?: string;
  gender?: "male" | "female" | "other";
  hospitalAffiliations: HospitalAffiliation[];
  availability: Availability[];
  rating: Rating;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorResponse {
  id: string;
  name: string;
  photo: string | null;
  qualification: string;
  specialization: string;
  languages?: string[];
  experienceYears?: number;
  registrationNumber: string;
  bio?: string;
  gender?: "male" | "female" | "other";
  consultationFee: number | null;
  hospitalAffiliations: any[];
  availability: Availability[];
  rating: Rating;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
