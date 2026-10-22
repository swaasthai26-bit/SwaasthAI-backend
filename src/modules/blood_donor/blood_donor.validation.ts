import { z } from "zod";
import { BLOOD_GROUPS } from "./blood_donor.constants";

const bloodGroupSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    let normalized = value;
    for (let i = 0; i < 2; i += 1) {
      try {
        const decoded = decodeURIComponent(normalized);
        if (decoded === normalized) break;
        normalized = decoded;
      } catch {
        break;
      }
    }
    normalized = normalized.trimStart().toUpperCase();
    normalized = normalized.replace(/\s+$/g, "+").replace(/\s+/g, "+").trim();
    if (["A", "B", "AB", "O"].includes(normalized)) return `${normalized}+`;
    return normalized;
  },
  z.enum(BLOOD_GROUPS),
);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?91?[6-9]\d{9}$|^[6-9]\d{9}$/);
const isoDateSchema = z.coerce
  .date()
  .refine((date) => date <= new Date(), "Date cannot be in the future");

export const donorSearchSchema = z
  .object({
    bloodGroup: bloodGroupSchema,
    state: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^\d{6}$/, "pincode must be a 6-digit number"),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(1).max(50).default(25).optional(),
    sort: z.enum(["distance", "recent"]).default("distance").optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((data) => (data.lat === undefined) === (data.lng === undefined), {
    message: "lat and lng must be provided together",
  });

export const registerDonorSchema = z
  .object({
    bloodGroup: bloodGroupSchema,
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
    lastDonationDate: isoDateSchema.optional(),
    isAvailable: z.boolean().default(true),
    eligibilitySelfDeclared: z.literal(true, {
      error: "Eligibility self-declaration is required",
    }),
  })
  .strict();

// All fields fully optional — no validation, frontend handles it
export const updateMyDonorSchema = z
  .object({
    isDonor: z.boolean().optional(),
    bloodGroup: bloodGroupSchema.optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    pincode: z.string().trim().optional(),
    lastDonationDate: z.coerce.date().optional(),
    isAvailable: z.boolean().optional(),
    eligibilitySelfDeclared: z.boolean().optional(),
    isContactVisible: z.boolean().optional(),
    stopAsDonor: z.boolean().optional(),
  })
  .strict();

export const donorAvailabilitySchema = z
  .object({ isAvailable: z.boolean() })
  .strict();
export const lastDonationSchema = z
  .object({ lastDonationDate: isoDateSchema })
  .strict();

export const adminCreateDonorSchema = z
  .object({
    userId: z.string().optional(),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    bloodGroup: bloodGroupSchema,
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
    lastDonationDate: isoDateSchema.optional(),
    isAvailable: z.boolean().default(true),
    isPhoneVerified: z.boolean().default(false),
    isVerified: z.boolean().default(false),
    eligibilitySelfDeclared: z.boolean().default(false),
  })
  .strict();

export const adminUpdateDonorSchema = adminCreateDonorSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required",
  );

export const adminDonorListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  bloodGroup: bloodGroupSchema.optional(),
  city: z.string().trim().optional(),
  isVerified: z.enum(["true", "false"]).optional(),
  isAvailable: z.enum(["true", "false"]).optional(),
  q: z.string().trim().optional(),
});

export const csvImportSchema = z.object({
  csvContent: z.string().min(1),
});

export type DonorSearchInput = z.infer<typeof donorSearchSchema>;
export type RegisterDonorInput = z.infer<typeof registerDonorSchema>;
export type UpdateMyDonorInput = z.infer<typeof updateMyDonorSchema>;
export type AdminCreateDonorInput = z.infer<typeof adminCreateDonorSchema>;
export type AdminUpdateDonorInput = z.infer<typeof adminUpdateDonorSchema>;
