import { z } from "zod";
import { BLOOD_GROUPS } from "../blood_donor/blood_donor.constants";

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "dateOfBirth must be a valid date",
  })
  .refine((value) => new Date(value) < new Date(), {
    message: "dateOfBirth cannot be in the future",
  })
  .refine(
    (value) => {
      // FR-1.1: age must be >= 13
      const dob = new Date(value);
      const today = new Date();
      let age = today.getUTCFullYear() - dob.getUTCFullYear();
      const m = today.getUTCMonth() - dob.getUTCMonth();
      if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
      return age >= 13;
    },
    { message: "User must be at least 13 years old" },
  );

const LocationSchema = z
  .object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  })
  .strict();

const AddressSchema = z
  .object({
    line: z.string().trim().min(5).max(500).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    state: z.string().trim().min(2).max(100).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Pincode must be 6 digits")
      .optional(),
    location: LocationSchema.optional(),
  })
  .strict()
  .optional();

export const FamilyMemberSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    dateOfBirth: dateOfBirthSchema,
    relation: z.string().trim().min(2).max(50),
    gender: z.enum(["male", "female", "other"]),
    mobileNumber: z.string().trim().regex(/^\+91[6-9]\d{9}$/).optional(),
    photoUrl: z.string().url("photoUrl must be a valid URL").optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  })
  .strict();

export const EmergencyContactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(/^\+91[6-9]\d{9}$/),
    relation: z.string().trim().min(2).max(50),
  })
  .strict();

export const PreferencesSchema = z
  .object({
    language: z.string().trim().min(2).max(10).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    notifications: z.boolean().optional(),
  })
  .strict();

export const FcmTokenSchema = z
  .object({
    token: z.string().trim().min(1),
    deviceId: z.string().trim().min(1).max(128),
    platform: z.enum(["android", "ios", "web"]).optional(),
  })
  .strict();

// Donor enrollment sub-schema — embedded inside updateMeSchema
// Frontend sends isDonor: true along with donor fields to become a donor
// Frontend sends isDonor: false to unregister as donor
const donorEnrollSchema = z.discriminatedUnion("isDonor", [
  z.object({
    isDonor: z.literal(true),
    donorBloodGroup: z.enum(BLOOD_GROUPS, { error: "donorBloodGroup is required when registering as donor" }),
    donorCity: z.string().trim().min(2).max(100).optional(),
    donorPincode: z.string().trim().regex(/^\d{6}$/).optional(),
    lastDonationDate: z.coerce
      .date()
      .refine((d) => d <= new Date(), "Date cannot be in the future")
      .optional(),
    isAvailable: z.boolean().default(true),
    eligibilitySelfDeclared: z.literal(true, {
      error: "eligibilitySelfDeclared must be true — user must accept the declaration",
    }),
  }),
  z.object({
    isDonor: z.literal(false),
  }),
]);

export const updateMeSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "firstName is required")
      .max(50)
      .optional(),
    lastName: z
      .string()
      .trim()
      .min(1, "lastName is required")
      .max(50)
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+91[6-9]\d{9}$/, "Phone must be in +91XXXXXXXXXX format (Indian mobile)")
      .optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    photoUrl: z.string().url("photoUrl must be a valid URL").optional(),
    address: AddressSchema,
    emergencyContact: EmergencyContactSchema.optional(),
    preferences: PreferencesSchema.optional(),
    dpdpConsentAccepted: z.boolean().optional(),
    // Donor enrollment — optional block. If isDonor is present the full donor
    // sub-schema is validated, otherwise the donor fields are ignored.
    donor: donorEnrollSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type DonorEnrollInput = z.infer<typeof donorEnrollSchema>;
export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>;
export type PreferencesInput = z.infer<typeof PreferencesSchema>;
export type FcmTokenInput = z.infer<typeof FcmTokenSchema>;
