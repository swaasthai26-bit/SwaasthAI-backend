import { z } from "zod";

export const specializationKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores");

export const createSpecializationSchema = z
  .object({
    key: specializationKeySchema,
    label: z.string().trim().min(2).max(100),
    iconKey: z.string().trim().min(1).max(100),
    imageUrl: z.string().url().optional(),
  })
  .strict();

export const updateSpecializationSchema = createSpecializationSchema
  .omit({ key: true })
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateSpecializationInput = z.infer<
  typeof createSpecializationSchema
>;
export type UpdateSpecializationInput = z.infer<
  typeof updateSpecializationSchema
>;
