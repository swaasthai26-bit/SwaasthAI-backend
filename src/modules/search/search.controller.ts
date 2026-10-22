import type { Request, Response } from "express";
import { hospitalService } from "../hospitals/hospital.service";
import { doctorService } from "../doctors/doctor.service";
import { validated } from "../../middleware/validate";
import { z } from "zod";

const searchSchema = z
  .object({
    q: z.string().trim().min(1),
    limit: z.coerce.number().min(1).max(50).default(10).optional(),
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
  })
  .strict();

type SearchQuery = z.infer<typeof searchSchema>;

export async function searchHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { q, limit, lat, lng } = validated<SearchQuery>(req, "query", searchSchema);

  const [hospitals, doctors] = await Promise.all([
    hospitalService.typeaheadSearch(q, limit, lat, lng),
    doctorService.typeaheadSearch(q, limit, lat, lng),
  ]);

  res.json({
    hospitals,
    doctors,
  });
}
