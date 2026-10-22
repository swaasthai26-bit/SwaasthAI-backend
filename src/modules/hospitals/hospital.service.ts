import { hospitalRepository } from "./hospital.repository";
import type {
  HospitalDocument,
  HospitalResponse,
  SearchQuery,
  Timings,
} from "./hospital.interface";
import { getRedisClient } from "../../db/redis";
import crypto from "crypto";

export class HospitalService {
  private CACHE_DURATION = 5 * 60; // 5 minutes
  private DETAIL_CACHE_DURATION = 60 * 60; // 1 hour

  private isOpenNow(timings?: Timings): boolean {
    // timings missing
    if (!timings) {
      return false;
    }
    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const currentDay = dayNames[istNow.getUTCDay()] as keyof Timings;
    const currentHHMM =
      istNow.getUTCHours().toString().padStart(2, "0") +
      ":" +
      istNow.getUTCMinutes().toString().padStart(2, "0");
    const todayTiming = timings[currentDay];
    // today's timing missing or closed
    if (!todayTiming || todayTiming.isClosed) {
      return false;
    }
    return currentHHMM >= todayTiming.open && currentHHMM <= todayTiming.close;
  }

  private buildHospitalResponse(
    hospital: any,
    distanceKm?: number,
    locale: string = "en",
  ): HospitalResponse {
    const isOpen = this.isOpenNow(hospital.timings);
    const insurancePlans = Array.isArray(hospital.acceptedInsurancePlans)
      ? hospital.acceptedInsurancePlans.map((id: any) =>
          typeof id === "string" ? id : id.toString(),
        )
      : [];

    // Pick localized name: use hi/or if available, fallback to English name
    const rawLocalized = hospital.localizedName;
    // Convert Mongoose subdoc to plain object if needed
    const localizedName: Record<string, string> =
      rawLocalized && typeof rawLocalized.toObject === "function"
        ? rawLocalized.toObject()
        : rawLocalized
        ? { ...(rawLocalized as object) }
        : {};
    const displayName =
      locale !== "en" && localizedName[locale]
        ? localizedName[locale]
        : hospital.name;

    return {
      id: hospital._id?.toString() || hospital.id,
      name: displayName,
      localizedName: Object.keys(localizedName).length > 0 ? localizedName : undefined,
      slug: hospital.slug,
      description: hospital.description,
      location: hospital.location,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      country: hospital.country,
      whatsappNumber: hospital.whatsappNumber,
      contactPhone: hospital.contactPhone,
      contactEmail: hospital.contactEmail,
      specializations: hospital.specializations,
      amenities: hospital.amenities,
      photos: hospital.photos,
      timings: hospital.timings,
      holidays: hospital.holidays,
      acceptedInsurancePlans: insurancePlans,
      startingConsultationFee: hospital.startingConsultationFee,
      rating: hospital.rating,
      status: hospital.status,
      isVerified: hospital.isVerified,
      verifiedAt: hospital.verifiedAt,
      distanceKm,
      isOpenNow: isOpen,
      hasWhatsApp: !!hospital.whatsappNumber,
      hasCashless: insurancePlans.length > 0,
      createdAt: hospital.createdAt,
      updatedAt: hospital.updatedAt,
    };
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  async getHospitalById(id: string): Promise<HospitalResponse | null> {
    const redis = getRedisClient();
    const cacheKey = `hospital:cache:${id}`;

    // Check cache
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const hospital = await hospitalRepository.findById(id);
    if (!hospital) return null;

    const response = this.buildHospitalResponse(hospital);

    // Set cache
    if (redis) {
      await redis.setex(
        cacheKey,
        this.DETAIL_CACHE_DURATION,
        JSON.stringify(response),
      );
    }

    return response;
  }

  async searchHospitals(query: SearchQuery, adminView = false) {
    const redis = getRedisClient();
    const queryHash = crypto
      .createHash("md5")
      .update(JSON.stringify({ ...query, adminView }))
      .digest("hex");
    const cacheKey = `search:cache:${queryHash}`;

    // Skip cache for admin view or openNow filter
    if (!query.openNow && !adminView && redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // ── When sort=distance with lat/lng, delegate to findNearby so $near
    //    is used — it sorts by true distance. No other filters are lost
    //    because findNearby also supports q and hasCashless.
    //    Only applies to public (non-admin) requests.
    if (
      !adminView &&
      (query.sort === "distance" || !query.sort) &&
      query.lat !== undefined &&
      query.lng !== undefined
    ) {
      const { hospitals, total, totalPages } = await hospitalRepository.findNearby(
        query.lat,
        query.lng,
        query.radius ?? 10,
        query.pageSize ?? 20,
        query.page ?? 1,
        query.q,
        query.hasCashless,
      );
      const locale = (query as any).locale ?? "en";
      const response = {
        data: hospitals.map((h) =>
          this.buildHospitalResponse(
            h,
            this.calculateDistance(query.lat!, query.lng!, h.location.coordinates[1], h.location.coordinates[0]),
            locale,
          ),
        ),
        pagination: {
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 20,
          total,
          totalPages,
        },
      };

      if (!query.openNow && redis) {
        await redis.setex(cacheKey, this.CACHE_DURATION, JSON.stringify(response));
      }
      return response;
    }

    // ── Standard search path (no lat/lng, or admin, or explicit non-distance sort)
    const { hospitals, total, page, pageSize, totalPages } =
      await hospitalRepository.search({ ...query, adminView } as any);

    const response = {
      data: hospitals.map((h: any) => {
        let distanceKm: number | undefined;
        if (query.lat && query.lng && h.location) {
          distanceKm = this.calculateDistance(query.lat, query.lng, h.location.coordinates[1], h.location.coordinates[0]);
        }
        return this.buildHospitalResponse(h, distanceKm);
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };

    // Set cache (skip if openNow filter or admin view)
    if (!query.openNow && !adminView && redis) {
      await redis.setex(
        cacheKey,
        this.CACHE_DURATION,
        JSON.stringify(response),
      );
    }

    return response;
  }

  async getNearbyHospitals(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    locale: string = "en",
    limit: number = 20,
    page: number = 1,
    q?: string,
    hasCashless?: boolean,
  ) {
    const { hospitals, total, totalPages } = await hospitalRepository.findNearby(lat, lng, radiusKm, limit, page, q, hasCashless);
    return {
      data: hospitals.map((h) =>
        this.buildHospitalResponse(
          h,
          this.calculateDistance(lat, lng, h.location.coordinates[1], h.location.coordinates[0]),
          locale,
        ),
      ),
      pagination: { page, limit, total, totalPages },
    };
  }

  async typeaheadSearch(q: string, limit?: number, lat?: number, lng?: number) {
    const results = await hospitalRepository.typeaheadSearch(q, limit);
    return results.map((h: any) => {
      let distanceKm: number | null = null;
      if (lat !== undefined && lng !== undefined && h.location?.coordinates) {
        distanceKm = this.calculateDistance(lat, lng, h.location.coordinates[1], h.location.coordinates[0]);
      }
      return {
        id: h._id?.toString(),
        name: h.name,
        slug: h.slug,
        city: h.city,
        location: h.location,
        specializations: h.specializations ?? [],
        rating: h.rating ?? { avg: 0, count: 0 },
        startingFee: h.startingConsultationFee ?? null,
        isOpenNow: this.isOpenNow(h.timings),
        hasCashless: Array.isArray(h.acceptedInsurancePlans) && h.acceptedInsurancePlans.length > 0,
        photos: Array.isArray(h.photos) ? h.photos : [],
        distanceKm,
      };
    });
  }

  async getTopRatedNearby(
    lat: number,
    lng: number,
    radiusKm: number = 10,
    limit: number = 10,
    minRating: number = 4.5,
    locale: string = "en",
    page: number = 1,
  ) {
    const { hospitals, total, totalPages } = await hospitalRepository.topRatedNearby(
      lat, lng, radiusKm, limit, minRating, page,
    );
    return {
      data: hospitals.map((h: any) => {
        const distanceKm = this.calculateDistance(lat, lng, h.location.coordinates[1], h.location.coordinates[0]);
        const built = this.buildHospitalResponse(h, distanceKm, locale);
        return {
          ...built,
          isTopRated: h.rating?.avg >= 4.5,
          hasCashless: Array.isArray(h.acceptedInsurancePlans) && h.acceptedInsurancePlans.length > 0,
        };
      }),
      pagination: { page, limit, total, totalPages },
    };
  }

  async createHospital(data: any): Promise<HospitalResponse> {
    const hospital = await hospitalRepository.create(data);
    return this.buildHospitalResponse(hospital);
  }

  async updateHospital(
    id: string,
    data: any,
  ): Promise<HospitalResponse | null> {
    const hospital = await hospitalRepository.update(id, data);
    if (!hospital) return null;

    // Invalidate cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`hospital:cache:${id}`);
    }

    return this.buildHospitalResponse(hospital);
  }

  async deleteHospitalPhoto(id: string, photoIndex: number): Promise<HospitalResponse | null> {
    const hospital = await hospitalRepository.findById(id);
    if (!hospital) return null;
    hospital.photos = (hospital.photos ?? [])
      .filter((_, index) => index !== photoIndex)
      .map((photo, index) => ({ ...photo, order: index })) as any;
    await hospital.save();

    const redis = getRedisClient();
    if (redis) {
      await redis.del(`hospital:cache:${id}`);
    }

    return this.buildHospitalResponse(hospital);
  }

  async deleteHospital(id: string): Promise<void> {
    await hospitalRepository.softDelete(id);

    // Invalidate cache
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`hospital:cache:${id}`);
    }
  }
}

export const hospitalService = new HospitalService();
