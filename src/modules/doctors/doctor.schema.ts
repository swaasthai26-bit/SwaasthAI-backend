import { model, Schema, Types } from "mongoose";
import { DoctorDocument } from "./doctor.interface";

const HospitalAffiliationSchema = new Schema(
  {
    hospitalId: {
      type: Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    consultationFee: {
      type: Number,
      required: true,
      min: 0,
    },
    isPrimary: {
      type: Boolean,
      required: true,
      default: false,
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const AvailabilitySchema = new Schema(
  {
    hospitalId: {
      type: Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },
    startTime: { type: String, required: true }, // HH:MM format
    endTime: { type: String, required: true }, // HH:MM format
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

const DoctorSchema = new Schema<DoctorDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
    qualification: {
      type: String,
      required: true,
      trim: true,
    },
    primarySpecialization: {
      type: String,
      required: true,
      index: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    experienceYears: {
      type: Number,
      min: 0,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      sparse: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    hospitalAffiliations: {
      type: [HospitalAffiliationSchema],
      required: true,
      default: [],
    },
    availability: {
      type: [AvailabilitySchema],
      required: true,
      default: [],
    },
    rating: {
      type: RatingSchema,
      required: true,
      default: { avg: 0, count: 0 },
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
DoctorSchema.index({ primarySpecialization: 1, isActive: 1 });
DoctorSchema.index({ createdAt: -1 });
DoctorSchema.index({ "rating.avg": -1 });

export const DoctorModel = model<DoctorDocument>("Doctor", DoctorSchema);
