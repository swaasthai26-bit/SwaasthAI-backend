import { model, Schema } from "mongoose";
import { UserDocument } from "./user.interface";

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

const AddressSchema = new Schema(
  {
    line: { type: String, trim: true, minlength: 5, maxlength: 500 },
    city: { type: String, trim: true, minlength: 2, maxlength: 100 },
    state: { type: String, trim: true, minlength: 2, maxlength: 100 },
    pincode: { type: String, trim: true, match: /^\d{6}$/ },
    location: LocationSchema,
  },
  { _id: false },
);

const FamilyMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    dateOfBirth: { type: Date, required: true },
    relation: { type: String, required: true, trim: true, maxlength: 50 },
    gender: { type: String, required: true, enum: ["male", "female", "other"] },
    mobileNumber: { type: String, trim: true, match: /^\+91[6-9]\d{9}$/ },
    photoUrl: { type: String, trim: true },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
  },
  { timestamps: false },
);

const EmergencyContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    phone: { type: String, required: true, trim: true, match: /^\+91[6-9]\d{9}$/ },
    relation: { type: String, required: true, trim: true, maxlength: 50 },
  },
  { _id: false },
);

const PreferencesSchema = new Schema(
  {
    language: { type: String, trim: true, default: "en" },
    theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
    notifications: { type: Boolean, default: true },
  },
  { _id: false },
);

const FcmTokenSchema = new Schema(
  {
    token: { type: String, required: true, trim: true },
    deviceId: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["android", "ios", "web"] },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const RecentlyViewedSchema = new Schema(
  {
    type: { type: String, required: true, enum: ["hospital", "doctor"] },
    refId: { type: String, required: true },
    viewedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDocument>(
  {
    phone: {
      type: String,
      required: false,   // Phone is now optional — saved for WhatsApp/calls but NOT used for auth
      trim: true,
      match: /^\+91[6-9]\d{9}$/,
      default: null,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      default: null,
    },
    googleId: {
      type: String,
      trim: true,
      default: null,
    },
    isEmailVerified: { type: Boolean, required: true, default: false },
    role: {
      type: String,
      required: true,
      enum: ["user", "content_admin", "platform_admin"],
      default: "user",
    },
    isPhoneVerified: { type: Boolean, required: true, default: false },
    isActive: { type: Boolean, required: true, default: true },

    firstName: { type: String, trim: true, minlength: 1, maxlength: 50 },
    lastName: { type: String, trim: true, minlength: 1, maxlength: 50 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    photoUrl: { type: String, trim: true },
    address: AddressSchema,
    savedHospitals: { type: [String], default: [] },
    familyMembers: {
      type: [FamilyMemberSchema],
      default: [],
      validate: {
        validator: (members: unknown[]) => members.length <= 5,
        message: "A user can have up to 5 family members",
      },
    },
    emergencyContact: EmergencyContactSchema,
    preferences: { type: PreferencesSchema, default: () => ({}) },
    fcmTokens: { type: [FcmTokenSchema], default: [] },
    dpdpConsentAt: { type: Date },
    recentlyViewed: {
      type: [RecentlyViewedSchema],
      default: [],
    },
    // Blood donor fields (embedded in user — no separate table for self-registered donors)
    isDonor: { type: Boolean, default: false },
    donorBloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", null],
      default: null,
    },
    isAvailable: { type: Boolean, default: false },
    isContactVisible: { type: Boolean, default: false },
    lastDonationDate: { type: Date, default: null },
    eligibilitySelfDeclared: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0, min: 0 },
    donateCount: { type: Number, default: 0, min: 0 },
    stopAsDonor: { type: Boolean, default: false },
    isDonorVerified: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Unique phone for non-deleted users (optional field — only enforced when phone is set).
UserSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" }, deletedAt: null },
    name: "uniq_phone_active",
  },
);

// Unique email for non-deleted users.
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" }, deletedAt: null },
    name: "uniq_email_active",
  },
);
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });

export const UserModel = model<UserDocument>("User", UserSchema);
