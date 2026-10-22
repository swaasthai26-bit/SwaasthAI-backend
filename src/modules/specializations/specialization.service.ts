import { ConflictError, NotFoundError } from "../../shared/errors";
import { SPECIALIZATIONS } from "../hospitals/specializations";
import { SpecializationModel } from "./specialization.model";
import type {
  CreateSpecializationInput,
  UpdateSpecializationInput,
} from "./specialization.zod";

let defaultsEnsured = false;

async function ensureDefaultSpecializations(): Promise<void> {
  if (defaultsEnsured) return;
  await SpecializationModel.bulkWrite(
    SPECIALIZATIONS.map((specialization) => ({
      updateOne: {
        filter: { key: specialization.key },
        update: { $setOnInsert: { ...specialization, deletedAt: null } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  defaultsEnsured = true;
}

function toResponse(specialization: any) {
  return {
    id: specialization._id?.toString(),
    key: specialization.key,
    label: specialization.label,
    iconKey: specialization.iconKey,
    imageUrl: specialization.imageUrl,
    createdAt: specialization.createdAt,
    updatedAt: specialization.updatedAt,
  };
}

export async function listSpecializations(page: number = 1, limit: number = 20) {
  await ensureDefaultSpecializations();
  const skip = (page - 1) * limit;
  const [specializations, total] = await Promise.all([
    SpecializationModel.find({ deletedAt: null })
      .sort({ label: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SpecializationModel.countDocuments({ deletedAt: null }),
  ]);
  return {
    data: specializations.map(toResponse),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createSpecialization(input: CreateSpecializationInput) {
  await ensureDefaultSpecializations();
  const existing = await SpecializationModel.findOne({ key: input.key });
  if (existing && !existing.deletedAt) {
    throw new ConflictError("Specialization key already exists");
  }
  if (existing) {
    Object.assign(existing, input, { deletedAt: null });
    await existing.save();
    return toResponse(existing);
  }
  const specialization = await SpecializationModel.create(input);
  return toResponse(specialization);
}

export async function updateSpecialization(
  key: string,
  input: UpdateSpecializationInput,
) {
  await ensureDefaultSpecializations();
  const specialization = await SpecializationModel.findOneAndUpdate(
    { key, deletedAt: null },
    input,
    { new: true },
  );
  if (!specialization) throw new NotFoundError("Specialization not found");
  return toResponse(specialization);
}

export async function deleteSpecialization(key: string) {
  await ensureDefaultSpecializations();
  const specialization = await SpecializationModel.findOneAndUpdate(
    { key, deletedAt: null },
    { deletedAt: new Date() },
  );
  if (!specialization) throw new NotFoundError("Specialization not found");
}

export async function deleteSpecializationImage(key: string) {
  await ensureDefaultSpecializations();
  const specialization = await SpecializationModel.findOneAndUpdate(
    { key, deletedAt: null },
    { $unset: { imageUrl: "" } },
    { new: true },
  );
  if (!specialization) throw new NotFoundError("Specialization not found");
  return toResponse(specialization);
}
