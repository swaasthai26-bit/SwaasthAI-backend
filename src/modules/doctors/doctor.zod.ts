import { z } from "zod";

const HospitalAffiliationSchema = z
  .object({
    hospitalId: z.string().min(24),
    consultationFee: z.number().min(0),
    isPrimary: z.boolean(),
    joinedAt: z.string().datetime().optional(),
  })
  .strict();

const AvailabilitySchema = z
  .object({
    hospitalId: z.string().min(24),
    dayOfWeek: z.enum([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  })
  .strict();

const RatingSchema = z
  .object({
    avg: z.number().min(0).max(5),
    count: z.number().min(0),
  })
  .strict();

export const createDoctorSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    photoUrl: z.string().url("Photo URL must be valid").optional(),
    qualification: z.string().trim().min(1),
    primarySpecialization: z.string().trim().min(1),
    languages: z.array(z.string().trim()).default([]),
    experienceYears: z.number().min(0).optional(),
    registrationNumber: z.string().trim().min(1),
    bio: z.string().trim().max(1000).optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    hospitalAffiliations: z
      .array(HospitalAffiliationSchema)
      .min(1, "At least one hospital affiliation required"),
    availability: z.array(AvailabilitySchema).default([]),
    rating: RatingSchema.optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateDoctorSchema = createDoctorSchema.partial();

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
