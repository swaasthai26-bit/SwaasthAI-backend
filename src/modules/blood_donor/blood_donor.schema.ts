import { model, Schema } from "mongoose";
import type { BloodDonorDocument } from "./blood_donor.interface";
import { BLOOD_GROUPS } from "./blood_donor.constants";

const LocationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

const ContactCountSchema = new Schema(
  {
    today: { type: Number, default: 0, min: 0 },
    thisWeek: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const BloodDonorSchema = new Schema<BloodDonorDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true,
      default: null,
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      sparse: true,
      match: /^\+91[6-9]\d{9}$/,
    },
    bloodGroup: { type: String, required: true, enum: BLOOD_GROUPS, index: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, trim: true, index: true },
    pincode: { type: String, trim: true, match: /^\d{6}$/ },
    location: { type: LocationSchema, required: true, index: "2dsphere" },
    lastDonationDate: { type: Date, default: null },
    lastAvailableAt: { type: Date, default: () => new Date() },
    isAvailable: { type: Boolean, required: true, default: true, index: true },
    isPhoneVerified: { type: Boolean, required: true, default: false },
    isVerified: { type: Boolean, required: true, default: false, index: true },
    eligibilitySelfDeclared: { type: Boolean, required: true, default: false },
    eligibilityDeclaredAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ["self_registered", "admin_imported"],
      required: true,
      default: "self_registered",
    },
    contactCount: { type: ContactCountSchema, default: () => ({ today: 0, thisWeek: 0, total: 0 }) },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    complaints: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BloodDonorSchema.index({ bloodGroup: 1, state: 1, city: 1, isAvailable: 1, isActive: 1 });
BloodDonorSchema.index({ bloodGroup: 1, city: 1, isAvailable: 1, isActive: 1 });
BloodDonorSchema.index({ location: "2dsphere" });
BloodDonorSchema.index({ userId: 1 }, { unique: true, sparse: true });
BloodDonorSchema.index({ phone: 1 }, { unique: true, sparse: true });
BloodDonorSchema.index({ createdAt: -1 });

export const BloodDonorModel = model<BloodDonorDocument>(
  "BloodDonor",
  BloodDonorSchema,
  "blood_donors",
);
