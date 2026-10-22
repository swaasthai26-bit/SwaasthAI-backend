import { z } from "zod";
const LocationSchema = z
  .object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  })
  .strict();

const DayTimingSchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    close: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    isClosed: z.boolean().optional(),
  })
  .strict();

const TimingsSchema = z
  .object({
    mon: DayTimingSchema,
    tue: DayTimingSchema,
    wed: DayTimingSchema,
    thu: DayTimingSchema,
    fri: DayTimingSchema,
    sat: DayTimingSchema,
    sun: DayTimingSchema,
  })
  .strict();

const PhotoSchema = z
  .object({
    url: z.string().url("Photo URL must be valid"),
    caption: z.string().trim().optional(),
    order: z.number().int().default(0),
  })
  .strict();

const RatingSchema = z
  .object({
    avg: z.number().min(0).max(5),
    count: z.number().min(0),
  })
  .strict();

export const createHospitalSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    localizedName: z
      .object({
        hi: z.string().trim().max(200).optional(),
        or: z.string().trim().max(200).optional(),
      })
      .optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9-]+$/,
        "Slug must be lowercase alphanumeric with hyphens",
      ),
    description: z.string().trim().max(2000).optional(),
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Pincode must be 6 digits"),
    country: z.string().trim().default("India"),
    location: LocationSchema,
    whatsappNumber: z
      .string()
      .trim()
      .regex(/^\+91[6-9]\d{9}$/, "WhatsApp number must be valid Indian phone")
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+91[6-9]\d{9}$/, "Contact phone must be valid Indian phone"),
    contactEmail: z.string().trim().email("Contact email must be valid"),
    specializations: z
      .array(z.string().trim().min(1))
      .min(1, "At least one specialization required"),
    amenities: z.array(z.string().trim()).default([]),
    photos: z.array(PhotoSchema).max(8, "A hospital can have up to 8 photos").default([]),
    timings: TimingsSchema,
    holidays: z.array(z.string().datetime()).default([]),
    acceptedInsurancePlans: z.array(z.string()).default([]),
    startingConsultationFee: z.number().min(0, "Consultation fee must be >= 0"),
    status: z
      .enum(["pending", "active", "suspended", "closed"])
      .default("pending"),
    isVerified: z.boolean().default(false),
  })
  .strict();

export const updateHospitalSchema = createHospitalSchema
  .partial()
  .extend({
    // Remove defaults so missing fields are truly undefined — prevents accidental reset
    status: z.enum(["pending", "active", "suspended", "closed"]).optional(),
    isVerified: z.boolean().optional(),
    country: z.string().trim().optional(),
    amenities: z.array(z.string().trim()).optional(),
    photos: z.array(PhotoSchema).max(8).optional(),
    holidays: z.array(z.string().datetime()).optional(),
    acceptedInsurancePlans: z.array(z.string()).optional(),
  });

export const searchHospitalSchema = z
  .object({
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
    radius: z.coerce.number().min(2).max(50).default(10).optional(),
    specialization: z
      .string()
      .transform((v) => v.split(","))
      .pipe(z.array(z.string().trim().min(1)))
      .optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    hasCashless: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    city: z.string().trim().min(2).max(100).optional(),
    pincode: z.string().trim().regex(/^\d{6}$/).optional(),
    minFee: z.coerce.number().min(0).optional(),
    maxFee: z.coerce.number().min(0).optional(),
    acceptedInsurancePlan: z.string().trim().optional(),
    insurerName: z.string().trim().optional(),
    openNow: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    q: z.string().trim().optional(),
    sort: z
      .enum(["distance", "rating", "fee", "fee_desc", "popularity", "cashless"])
      .default("distance")
      .optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    availableDate: z.string().trim().optional(),  // YYYY-MM-DD format
    page: z.coerce.number().min(1).default(1).optional(),
    pageSize: z.coerce.number().min(1).max(100).default(20).optional(),
  })
  .strict();

export type CreateHospitalInput = z.infer<typeof createHospitalSchema>;
export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;
export type SearchHospitalInput = z.infer<typeof searchHospitalSchema>;
