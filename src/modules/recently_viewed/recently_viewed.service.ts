import { UserModel } from "../users/user.schema";
import { HospitalModel } from "../hospitals/hospital.schema";
import { DoctorModel } from "../doctors/doctor.schema";

const MAX_ITEMS = 10;

/**
 * Fire-and-forget: record a view for a logged-in user.
 * Deduplicates by refId — moves existing entry to top.
 * Caps at MAX_ITEMS, dropping the oldest.
 */
export async function recordView(
  userId: string,
  type: "hospital" | "doctor",
  refId: string,
): Promise<void> {
  try {
    // Remove existing entry for same refId (dedup), then push new entry at top,
    // then trim to MAX_ITEMS from the end (keeping newest).
    await UserModel.updateOne(
      { _id: userId, deletedAt: null },
      [
        {
          $set: {
            recentlyViewed: {
              $slice: [
                {
                  $concatArrays: [
                    [{ type, refId, viewedAt: new Date() }],
                    {
                      $filter: {
                        input: { $ifNull: ["$recentlyViewed", []] },
                        as: "item",
                        cond: { $ne: ["$$item.refId", refId] },
                      },
                    },
                  ],
                },
                MAX_ITEMS,
              ],
            },
          },
        },
      ],
    );
  } catch {
    // Non-critical — never fail the main request
  }
}

/**
 * Fetch recently viewed list with full hospital/doctor details.
 */
export async function getRecentlyViewed(
  userId: string,
  lat?: number,
  lng?: number,
) {
  const user = await UserModel.findById(userId)
    .select("recentlyViewed")
    .lean();

  if (!user || !user.recentlyViewed || user.recentlyViewed.length === 0) {
    return [];
  }

  const items = user.recentlyViewed as Array<{
    type: "hospital" | "doctor";
    refId: string;
    viewedAt: Date;
  }>;

  const hospitalIds = items
    .filter((i) => i.type === "hospital")
    .map((i) => i.refId);
  const doctorIds = items
    .filter((i) => i.type === "doctor")
    .map((i) => i.refId);

  // Parallel fetch
  const [hospitals, doctors, primaryHospitals] = await Promise.all([
    hospitalIds.length > 0
      ? HospitalModel.find({
          _id: { $in: hospitalIds },
          deletedAt: null,
          isVerified: true,
          status: "active",
        })
          .select("name city photos rating startingConsultationFee location specializations")
          .lean()
      : [],
    doctorIds.length > 0
      ? DoctorModel.find({
          _id: { $in: doctorIds },
          deletedAt: null,
          isActive: true,
        })
          .select("name photoUrl primarySpecialization rating hospitalAffiliations")
          .lean()
      : [],
    [] as any[], // placeholder, filled below
  ]);

  // Collect primary hospital IDs for doctors so we can fetch city
  const primaryHospitalIdSet = new Set<string>();
  for (const d of doctors as any[]) {
    const primaryAff = (d.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
    if (primaryAff?.hospitalId) primaryHospitalIdSet.add(primaryAff.hospitalId.toString());
  }
  const doctorHospitals = primaryHospitalIdSet.size > 0
    ? await HospitalModel.find({ _id: { $in: [...primaryHospitalIdSet] } })
        .select("city")
        .lean()
    : [];
  const doctorHospitalMap = new Map(
    (doctorHospitals as any[]).map((h: any) => [h._id.toString(), h]),
  );

  // Build lookup maps
  const hospitalMap = new Map(hospitals.map((h: any) => [h._id.toString(), h]));
  const doctorMap = new Map(doctors.map((d: any) => [d._id.toString(), d]));

  // Build ordered results preserving recentlyViewed order (newest first)
  const result: any[] = [];

  for (const item of items) {
    if (item.type === "hospital") {
      const h = hospitalMap.get(item.refId);
      if (!h) continue;

      let distanceKm: number | undefined;
      if (lat !== undefined && lng !== undefined && h.location?.coordinates) {
        distanceKm = calcDistance(lat, lng, h.location.coordinates[1], h.location.coordinates[0]);
      }

      result.push({
        type: "hospital",
        id: h._id.toString(),
        name: h.name,
        city: h.city,
        photo: Array.isArray(h.photos) && h.photos.length > 0 ? h.photos[0].url : null,
        rating: h.rating ? { avg: h.rating.avg, count: h.rating.count } : { avg: 0, count: 0 },
        startingConsultationFee: h.startingConsultationFee,
        specializations: h.specializations ?? [],
        distanceKm: distanceKm ?? null,
        viewedAt: item.viewedAt instanceof Date ? item.viewedAt.toISOString() : item.viewedAt,
      });
    } else {
      const d = doctorMap.get(item.refId);
      if (!d) continue;

      // Get consultation fee and city from primary affiliation
      const primaryAff = (d.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
      const consultationFee = primaryAff?.consultationFee ?? null;
      const affiliatedHospital = primaryAff
        ? doctorHospitalMap.get(primaryAff.hospitalId?.toString())
        : null;
      const city = (affiliatedHospital as any)?.city ?? null;

      result.push({
        type: "doctor",
        id: d._id.toString(),
        name: d.name,
        photo: d.photoUrl ?? null,
        specializations: d.primarySpecialization ? [d.primarySpecialization] : [],
        city,
        rating: d.rating ? { avg: d.rating.avg, count: d.rating.count } : { avg: 0, count: 0 },
        consultationFee,
        distanceKm: null,
        viewedAt: item.viewedAt instanceof Date ? item.viewedAt.toISOString() : item.viewedAt,
      });
    }
  }

  return result;
}

/**
 * Clear all recently viewed for a user.
 */
export async function clearRecentlyViewed(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId, deletedAt: null },
    { $set: { recentlyViewed: [] } },
  );
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
