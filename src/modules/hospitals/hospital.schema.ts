import { model, Schema, Types } from "mongoose";
import { HospitalDocument } from "./hospital.interface";

const LocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  { _id: false },
);

const DayTimingSchema = new Schema(
  {
    open: { type: String, required: true }, // HH:MM format
    close: { type: String, required: true }, // HH:MM format
    isClosed: { type: Boolean, default: false },
  },
  { _id: false },
);

const TimingsSchema = new Schema(
  {
    mon: { type: DayTimingSchema, required: true },
    tue: { type: DayTimingSchema, required: true },
    wed: { type: DayTimingSchema, required: true },
    thu: { type: DayTimingSchema, required: true },
    fri: { type: DayTimingSchema, required: true },
    sat: { type: DayTimingSchema, required: true },
    sun: { type: DayTimingSchema, required: true },
  },
  { _id: false },
);

const PhotoSchema = new Schema(
  {
    url: { type: String, required: true },
    caption: { type: String, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const RatingSchema = new Schema(
  {
    avg: { type: Number, required: true, default: 0, min: 0, max: 5 },
    count: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const LocalizedNameSchema = new Schema(
  {
    hi: { type: String, trim: true, maxlength: 200 },
    or: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const HospitalSchema = new Schema<HospitalDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    localizedName: {
      type: LocalizedNameSchema,
      default: {},
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    location: {
      type: LocationSchema,
      required: true,
      index: "2dsphere",
    },
    address: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{6}$/,
    },
    country: {
      type: String,
      required: true,
      trim: true,
      default: "India",
    },
    whatsappNumber: {
      type: String,
      trim: true,
      match: /^\+91[6-9]\d{9}$/,
      default: null,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+91[6-9]\d{9}$/,
    },
    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    specializations: {
      type: [String],
      required: true,
      default: [],
      index: true,
    },
    amenities: {
      type: [String],
      default: [],
    },
    photos: {
      type: [PhotoSchema],
      default: [],
    },
    timings: {
      type: TimingsSchema,
      required: true,
    },
    holidays: {
      type: [Date],
      default: [],
    },
    acceptedInsurancePlans: {
      type: [String],
      default: [],
    },
    startingConsultationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    rating: {
      type: RatingSchema,
      required: true,
      default: { avg: 0, count: 0 },
    },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "closed"],
      required: true,
      default: "pending",
      index: true,
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
HospitalSchema.index({ location: "2dsphere" });
HospitalSchema.index(
  { city: 1, isVerified: 1, status: 1 },
  { name: "idx_city_verified_status" },
);
HospitalSchema.index(
  { slug: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    name: "uniq_slug_active",
  },
);
HospitalSchema.index({ createdAt: -1 });
HospitalSchema.index({ "rating.avg": -1 });
HospitalSchema.index({ state: 1, city: 1 });
HospitalSchema.index({ specializations: 1, status: 1 });

HospitalSchema.index({
  name: "text",
  city: "text",
  state: "text",
  specializations: "text",
  address: "text",
});

export const HospitalModel = model<HospitalDocument>(
  "Hospital",
  HospitalSchema,
);
