import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { hospitalService } from "./hospital.service";
import { doctorService } from "../doctors/doctor.service";
import { getMe } from "../users/user.service";
import { validated } from "../../middleware/validate";
import { AuthError, NotFoundError, ValidationError } from "../../shared/errors";
import { getLocaleFromRequest } from "../../middleware/localizationMiddleware";
import { recordView } from "../recently_viewed/recently_viewed.service";
import type {
  CreateHospitalInput,
  SearchHospitalInput,
  UpdateHospitalInput,
} from "./hospital.zod";

export async function listHospitalsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const searchQuery = validated<SearchHospitalInput>(req, "query");
  // Admin routes have req.user with admin role — show all hospitals including pending/unverified
  const adminView = req.user?.role === "content_admin" || req.user?.role === "platform_admin";
  const result = await hospitalService.searchHospitals(searchQuery, adminView);
  res.json(result);
}

export async function nearbyHospitalsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { lat, lng, radius, limit, page, q, hasCashless } = req.query as any;

  if (!lat || !lng) {
    throw new AuthError("Latitude and longitude are required", "BAD_REQUEST");
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radiusKm = radius ? Math.max(2, Math.min(50, parseInt(radius))) : 10;
  const limitNum = limit ? Math.max(1, Math.min(100, parseInt(limit))) : 20;
  const pageNum = page ? Math.max(1, parseInt(page)) : 1;
  const searchTerm = q?.toString().trim() || undefined;
  const cashlessOnly = hasCashless === "true";

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new AuthError("Invalid latitude or longitude", "BAD_REQUEST");
  }

  const result = await hospitalService.getNearbyHospitals(
    latitude,
    longitude,
    radiusKm,
    getLocaleFromRequest(req),
    limitNum,
    pageNum,
    searchTerm,
    cashlessOnly,
  );

  res.json({
    data: result.data,
    pagination: result.pagination,
    location: { lat: latitude, lng: longitude },
    radius: radiusKm,
  });
}

export async function topRatedNearbyHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { lat, lng, radius, limit, minRating, page } = req.query as any;

  if (!lat || !lng) {
    throw new AuthError("lat and lng are required", "BAD_REQUEST");
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new AuthError("Invalid lat or lng", "BAD_REQUEST");
  }

  const radiusKm = radius ? Math.max(1, Math.min(50, parseFloat(radius))) : 10;
  const limitNum = limit ? Math.max(1, Math.min(100, parseInt(limit))) : 10;
  const pageNum = page ? Math.max(1, parseInt(page)) : 1;
  const minRatingNum = minRating ? Math.max(0, Math.min(5, parseFloat(minRating))) : 4.5;

  const result = await hospitalService.getTopRatedNearby(
    latitude,
    longitude,
    radiusKm,
    limitNum,
    minRatingNum,
    getLocaleFromRequest(req),
    pageNum,
  );

  res.json({
    data: result.data,
    pagination: result.pagination,
    meta: {
      location: { lat: latitude, lng: longitude },
      radiusKm,
      minRating: minRatingNum,
    },
  });
}

export async function nearbyMyHospitalsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Require authentication
  if (!req.user) {
    throw new AuthError("Authentication required", "UNAUTHORIZED");
  }

  // Get user's location from their profile
  const user = await getMe(req.user.id);

  // Validate user has complete location with coordinates
  if (!user.address) {
    throw new AuthError(
      "Address not found in your profile. Please add your address and location coordinates first using PUT /api/me endpoint.",
      "ADDRESS_NOT_FOUND",
    );
  }

  if (!user.address.location) {
    throw new AuthError(
      "Location coordinates not found. Please add your address with geolocation coordinates using PUT /api/me endpoint.",
      "LOCATION_COORDINATES_MISSING",
    );
  }

  if (
    !user.address.location.coordinates ||
    user.address.location.coordinates.length !== 2
  ) {
    throw new AuthError(
      "Invalid location coordinates. Please update your address with valid geolocation coordinates [longitude, latitude] using PUT /api/me endpoint.",
      "INVALID_COORDINATES",
    );
  }

  const [longitude, latitude] = user.address.location.coordinates;

  // Validate coordinates are valid numbers
  if (isNaN(longitude) || isNaN(latitude)) {
    throw new AuthError(
      "Location coordinates are invalid numbers. Please update your address with valid geolocation coordinates.",
      "INVALID_COORDINATE_VALUES",
    );
  }

  // Validate latitude/longitude ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new AuthError(
      "Location coordinates are out of valid range. Latitude must be between -90 and 90, Longitude between -180 and 180.",
      "COORDINATES_OUT_OF_RANGE",
    );
  }

  const { radius } = req.query as any;
  const radiusKm = radius ? Math.max(1, Math.min(50, parseInt(radius))) : 10;

  // Perform hospital search
  const result = await hospitalService.getNearbyHospitals(
    latitude,
    longitude,
    radiusKm,
  );

  res.json({
    success: true,
    data: result.data,
    userLocation: {
      lat: latitude,
      lng: longitude,
      address: user.address.line || "Address line not provided",
      city: user.address.city || "City not specified",
      state: user.address.state || "State not specified",
      pincode: user.address.pincode || "Pincode not provided",
    },
    radius: radiusKm,
    totalFound: result.data.length,
    message: `Found ${result.data.length} hospitals within ${radiusKm} km of your location`,
  });
}

export async function checkProfileReadinessHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Require authentication
  if (!req.user) {
    throw new AuthError("Authentication required", "UNAUTHORIZED");
  }

  // Get user's location from their profile
  const user = await getMe(req.user.id);

  const profileStatus = {
    isReady: false,
    missingFields: [] as string[],
    userInfo: {
      id: user._id?.toString(),
      phone: user.phone,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    },
    addressInfo: null as any,
    requiredToSearch: false,
    instructions: [] as string[],
  };

  // Check address
  if (!user.address) {
    profileStatus.missingFields.push("address");
    profileStatus.instructions.push(
      "1. Call PUT /api/me with your address details including location coordinates",
    );
  } else {
    profileStatus.addressInfo = {
      line: user.address.line || null,
      city: user.address.city || null,
      state: user.address.state || null,
      pincode: user.address.pincode || null,
    };

    // Check location coordinates
    if (!user.address.location) {
      profileStatus.missingFields.push("location");
      profileStatus.instructions.push(
        "Location coordinates missing. Update your address with geolocation coordinates using PUT /api/me",
      );
    } else if (
      !user.address.location.coordinates ||
      user.address.location.coordinates.length !== 2
    ) {
      profileStatus.missingFields.push("coordinates");
      profileStatus.instructions.push(
        "Invalid coordinates format. Coordinates should be [longitude, latitude]",
      );
    } else {
      const [longitude, latitude] = user.address.location.coordinates;

      if (isNaN(longitude) || isNaN(latitude)) {
        profileStatus.missingFields.push("coordinate_values");
        profileStatus.instructions.push("Coordinates contain invalid numbers");
      } else if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        profileStatus.missingFields.push("coordinate_range");
        profileStatus.instructions.push(
          "Coordinates out of valid range. Latitude: -90 to 90, Longitude: -180 to 180",
        );
      } else {
        // All coordinates are valid
        profileStatus.addressInfo.location = {
          coordinates: user.address.location.coordinates,
          lat: latitude,
          lng: longitude,
        };
      }
    }
  }

  // Determine if profile is ready for hospital search
  profileStatus.isReady = profileStatus.missingFields.length === 0;
  profileStatus.requiredToSearch = profileStatus.isReady;

  if (profileStatus.isReady) {
    profileStatus.instructions = [
      "Your profile is ready! Call GET /api/hospitals/nearby-me to search for nearby hospitals",
    ];
  } else {
    profileStatus.instructions.push(
      "\n2. After updating, call GET /api/hospitals/nearby-me to search for nearby hospitals",
    );
  }

  res.json(profileStatus);
}

export async function getHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  assertObjectId(id, "hospitalId");
  const hospital = await hospitalService.getHospitalById(id);
  if (!hospital) {
    throw new NotFoundError("Hospital not found");
  }
  // Fire-and-forget: record view for logged-in users only
  if (req.user?.id) {
    recordView(req.user.id, "hospital", id);
  }
  res.json(hospital);
}

export async function getHospitalDoctorsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  res.json({ data: await doctorService.getDoctorsByHospital(id) });
}

export async function verifyHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }
  assertObjectId(req.params.id as string, "hospitalId");
  const hospital = await hospitalService.updateHospital(
    req.params.id as string,
    {
      isVerified: true,
      status: "active",
      verifiedAt: new Date(),
    },
  );
  if (!hospital) throw new NotFoundError("Hospital not found");
  res.json(hospital);
}

export async function createHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can create
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const data = validated<CreateHospitalInput>(req);
  const hospital = await hospitalService.createHospital(data);
  res.status(200).json(hospital);
}

export async function updateHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can update
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const { id } = req.params as { id: string };
  assertObjectId(id, "hospitalId");
  const data = validated<UpdateHospitalInput>(req);
  const hospital = await hospitalService.updateHospital(id, data);
  if (!hospital) {
    throw new NotFoundError("Hospital not found");
  }
  res.json(hospital);
}

export async function deleteHospitalPhotoHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const { id, photoIndex } = req.params as { id: string; photoIndex: string };
  assertObjectId(id, "hospitalId");
  const index = Number(photoIndex);
  if (!Number.isInteger(index) || index < 0) {
    throw new ValidationError("photoIndex must be a non-negative integer");
  }
  const hospital = await hospitalService.deleteHospitalPhoto(id, index);
  if (!hospital) {
    throw new NotFoundError("Hospital not found");
  }
  res.json(hospital);
}

export async function deleteHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can delete
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const { id } = req.params as { id: string };
  assertObjectId(id, "hospitalId");
  await hospitalService.deleteHospital(id);
  res.json({ message: "Hospital deleted" });
}

function assertObjectId(value: string, field: string): void {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new ValidationError(
      `${field} must be a valid 24-character MongoDB ObjectId`,
      {
        fields: {
          [field]: ["Invalid ObjectId"],
        },
      },
    );
  }
}
