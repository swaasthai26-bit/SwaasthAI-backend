import type { Request, Response } from "express";
import {
  createSpecialization,
  deleteSpecialization,
  deleteSpecializationImage,
  listSpecializations,
  updateSpecialization,
} from "./specialization.service";
import {
  createSpecializationSchema,
  specializationKeySchema,
  updateSpecializationSchema,
} from "./specialization.zod";
import { getLocaleFromRequest } from "../../middleware/localizationMiddleware";
import { LocalizationService } from "../../shared/localization/localizationService";

export async function getSpecializationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const page = Math.max(1, parseInt((req.query.page as string) || "1"));
  const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "20")));
  const locale = getLocaleFromRequest(req);

  const { data: specializations, pagination } = await listSpecializations(page, limit);

  const localized = specializations.map((s) => {
    // For non-English locales, prefer the translated label if one exists.
    // For English (or any locale without a translation), always use the DB
    // label so that admin edits to the English label are reflected immediately.
    let label = s.label;
    if (locale !== "en") {
      const translatedLabel = LocalizationService.translate(`specialization.${s.key}`, locale);
      if (translatedLabel !== `specialization.${s.key}`) {
        label = translatedLabel;
      }
    }
    return { ...s, label };
  });

  res.json({
    status: true,
    message: "Data fetched successfully",
    data: localized,
    pagination,
  });
}

export async function createSpecializationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = createSpecializationSchema.parse(req.body);
  res.status(200).json({ data: await createSpecialization(input) });
}

export async function updateSpecializationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const key = specializationKeySchema.parse(req.params.key);
  const input = updateSpecializationSchema.parse(req.body);
  res.json({ data: await updateSpecialization(key, input) });
}

export async function deleteSpecializationHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const key = specializationKeySchema.parse(req.params.key);
  await deleteSpecialization(key);
  res.status(200).json({ message: "Specialization deleted successfully" });
}

export async function deleteSpecializationImageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const key = specializationKeySchema.parse(req.params.key);
  res.json({ data: await deleteSpecializationImage(key) });
}
