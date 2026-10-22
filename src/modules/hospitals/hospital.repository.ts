import { Types } from "mongoose";
import { HospitalModel } from "./hospital.schema";
import type { HospitalDocument, SearchQuery } from "./hospital.interface";
import { resolveGeoPoint } from "../geo/geo.utils";

export class HospitalRepository {
  async create(data: any): Promise<HospitalDocument> {
    return HospitalModel.create(data);
  }

  async findById(id: string): Promise<HospitalDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return HospitalModel.findOne({ _id: id, deletedAt: null });
  }

  async findBySlug(slug: string): Promise<HospitalDocument | null> {
    return HospitalModel.findOne({ slug, deletedAt: null });
  }

  async findAll(): Promise<HospitalDocument[]> {
    return HospitalModel.find({
      deletedAt: null,
      isVerified: true,
      status: "active",
    });
  }

  async search(query: SearchQuery & { adminView?: boolean }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // Admin sees all hospitals; public sees only active+verified
    const filters: any = { deletedAt: null };
    if (!query.adminView) {
      filters.isVerified = true;
      filters.status = "active";
    }

    // Text search — use regex to avoid $text sort conflicts
    if (query.q) {
      if (query.adminView) {
        filters.$or = [
          { name: { $regex: query.q, $options: "i" } },
          { city: { $regex: query.q, $options: "i" } },
          { address: { $regex: query.q, $options: "i" } },
        ];
      } else {
        // Use regex for public too — avoids $text + custom sort conflict
        filters.$or = [
          { name: { $regex: query.q, $options: "i" } },
          { city: { $regex: query.q, $options: "i" } },
          { specializations: { $regex: query.q, $options: "i" } },
          { address: { $regex: query.q, $options: "i" } },
        ];
      }
    }
    if (query.city) {
      filters.city = { $regex: query.city, $options: "i" };
    }
    if (query.pincode) {
      filters.pincode = query.pincode;
    }

    // Specialization filter
    if (query.specialization && query.specialization.length > 0) {
      filters.specializations = { $in: query.specialization };
    }

    // Rating filter
    if (query.minRating) {
      filters["rating.avg"] = { $gte: query.minRating };
    }
    if (query.minFee !== undefined || query.maxFee !== undefined) {
      filters.startingConsultationFee = {
        ...(query.minFee !== undefined ? { $gte: query.minFee } : {}),
        ...(query.maxFee !== undefined ? { $lte: query.maxFee } : {}),
      };
    }
    if (query.acceptedInsurancePlan) {
      filters.acceptedInsurancePlans = query.acceptedInsurancePlan;
    }
    if ((query as any).acceptedInsurancePlanIds?.length > 0) {
      filters.acceptedInsurancePlans = { $in: (query as any).acceptedInsurancePlanIds };
    }
    if (query.hasCashless) {
      filters.acceptedInsurancePlans = { $exists: true, $ne: [] };
    }
    // Use $geoWithin for all search queries with lat/lng — avoids $near sort conflict
    let queryObj = HospitalModel.find(filters);
    const geoPoint =
      query.lat !== undefined && query.lng !== undefined ? resolveGeoPoint(query) : null;
    if (geoPoint) {
      const radiusInMeters = Math.max(2, Math.min(50, query.radius || 10)) * 1000;
      // Always use $geoWithin (compatible with $or, sorting, and other filters)
      filters.location = {
        $geoWithin: {
          $centerSphere: [geoPoint.coordinates, radiusInMeters / 6378100],
        },
      };
      queryObj = HospitalModel.find(filters);
    }

    // Sorting
    let sortObj: any = { "rating.avg": -1, createdAt: -1 };
    if (query.sort === "distance") {
      // When geo-filtered, $geoWithin doesn't sort by distance natively.
      // Best approximation: sort by rating desc so closest area results are
      // still high quality. Frontend should use /nearby for true distance sort.
      sortObj = geoPoint
        ? { "rating.avg": -1, "rating.count": -1 }
        : { "rating.avg": -1, createdAt: -1 };
    } else if (query.sort === "rating") {
      sortObj = { "rating.avg": -1, "rating.count": -1 };
    } else if (query.sort === "popularity") {
      sortObj = { "rating.count": -1 };
    } else if (query.sort === "fee") {
      sortObj = { startingConsultationFee: 1 };
    } else if (query.sort === "fee_desc") {
      sortObj = { startingConsultationFee: -1 };
    } else if (query.sort === "cashless") {
      // Hospitals with cashless insurance first
      filters.acceptedInsurancePlans = { $exists: true, $ne: [] };
      sortObj = { "rating.avg": -1 };
    }

    const [hospitals, total] = await Promise.all([
      queryObj.sort(sortObj).skip(skip).limit(pageSize).lean(),
      HospitalModel.countDocuments(filters),
    ]);

    return {
      hospitals: hospitals as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    limit: number = 20,
    page: number = 1,
    q?: string,
    hasCashless?: boolean,
  ): Promise<{ hospitals: HospitalDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const radiusInMeters = Math.max(2, Math.min(50, radiusKm)) * 1000;
    const skip = (page - 1) * limit;

    const baseFilter: any = {
      deletedAt: null,
      isVerified: true,
      status: "active",
    };

    if (hasCashless) {
      baseFilter.acceptedInsurancePlans = { $exists: true, $ne: [] };
    }

    // When q is provided, use $geoWithin (compatible with $or) instead of $near
    if (q) {
      baseFilter.$or = [
        { name: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
        { specializations: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
      ];
      baseFilter.location = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusInMeters / 6378100],
        },
      };

      const [hospitals, total] = await Promise.all([
        HospitalModel.find(baseFilter)
          .sort({ "rating.avg": -1 })
          .skip(skip)
          .limit(limit),
        HospitalModel.countDocuments(baseFilter),
      ]);

      return { hospitals, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // No text search — use $near for distance-sorted results
    const nearFilter = {
      ...baseFilter,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusInMeters,
        },
      },
    };

    // $near doesn't support countDocuments directly — run both in parallel
    const [hospitals, total] = await Promise.all([
      HospitalModel.find(nearFilter).skip(skip).limit(limit),
      HospitalModel.countDocuments({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInMeters / 6378100],
          },
        },
        deletedAt: null,
        isVerified: true,
        status: "active",
      }),
    ]);

    return { hospitals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, data: any): Promise<HospitalDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    // Use $set to only update provided fields — prevents accidental reset of isVerified/status
    return HospitalModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async softDelete(id: string): Promise<HospitalDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return HospitalModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );
  }

  async findByCity(city: string): Promise<HospitalDocument[]> {
    return HospitalModel.find({
      city,
      deletedAt: null,
      isVerified: true,
      status: "active",
    });
  }

  async typeaheadSearch(q: string, limit: number = 10) {
    return HospitalModel.find(
      {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { city: { $regex: q, $options: "i" } },
          { specializations: { $regex: q, $options: "i" } },
          { address: { $regex: q, $options: "i" } },
        ],
        deletedAt: null,
        isVerified: true,
        status: "active",
      },
    )
      .sort({ "rating.avg": -1 })
      .limit(limit)
      .select(
        "name slug city location rating startingConsultationFee timings acceptedInsurancePlans photos specializations",
      )
      .lean();
  }

  async topRatedNearby(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    limit: number = 10,
    minRating: number = 4.5,
    page: number = 1,
  ) {
    const radiusInMeters = Math.min(radiusKm, 50) * 1000;
    const skip = (page - 1) * limit;
    const filter = {
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radiusInMeters,
        },
      },
      deletedAt: null,
      isVerified: true,
      status: "active",
      "rating.avg": { $gte: minRating },
    };

    const [hospitals, total] = await Promise.all([
      HospitalModel.find(filter)
        .sort({ "rating.avg": -1, "rating.count": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HospitalModel.countDocuments({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], radiusInMeters / 6378100],
          },
        },
        deletedAt: null,
        isVerified: true,
        status: "active",
        "rating.avg": { $gte: minRating },
      }),
    ]);

    return { hospitals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const hospitalRepository = new HospitalRepository();
