import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth } from "../../middleware/requireAuth";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { ReviewModel } from "../reviews/review.model";
import { HospitalModel } from "./hospital.schema";
import {
  listHospitalsHandler,
  nearbyHospitalsHandler,
  topRatedNearbyHandler,
  nearbyMyHospitalsHandler,
  checkProfileReadinessHandler,
  getHospitalHandler,
  createHospitalHandler,
  updateHospitalHandler,
  deleteHospitalHandler,
  deleteHospitalPhotoHandler,
  getHospitalDoctorsHandler,
  verifyHospitalHandler,
} from "./hospital.controller";
import {
  searchHospitalSchema,
  createHospitalSchema,
  updateHospitalSchema,
} from "./hospital.zod";

const router = Router();

// Public routes
router.get(
  "/",
  validate(searchHospitalSchema, "query"),
  asyncHandler(listHospitalsHandler),
);

// Authenticated routes - must come before /nearby and /:id to avoid routing conflicts
router.get(
  "/check-profile-readiness",
  requireAuth,
  asyncHandler(checkProfileReadinessHandler),
);
router.get("/nearby-me", requireAuth, asyncHandler(nearbyMyHospitalsHandler));

// Public route with query params
router.get("/nearby", asyncHandler(nearbyHospitalsHandler));
router.get("/top-rated", asyncHandler(topRatedNearbyHandler));
router.get("/:id/doctors", asyncHandler(getHospitalDoctorsHandler));
router.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const data = await ReviewModel.find({
      targetType: "hospital",
      targetId: req.params.id,
      adminStatus: "approved",
    }).sort({ createdAt: -1 });
    res.json({ data });
  }),
);
router.get("/:id", optionalAuth, asyncHandler(getHospitalHandler));

// Admin-only routes
router.post(
  "/",
  requireAuth,
  multipartImageUpload({
    fileField: "photos",
    targetField: "photos",
    multiple: true,
    minFiles: 1,
    maxFiles: 8,
    minFilesMessage: "upload at least one hospital image",
    asPhotoObjects: true,
    jsonFields: [
      "location",
      "specializations",
      "amenities",
      "timings",
      "holidays",
      "acceptedInsurancePlans",
    ],
    numberFields: ["startingConsultationFee"],
    booleanFields: ["isVerified"],
    getBaseName: (req) => String(req.body.name ?? "hospital"),
  }),
  validate(createHospitalSchema, "body"),
  asyncHandler(createHospitalHandler),
);
router.put(
  "/:id",
  requireAuth,
  multipartImageUpload({
    fileField: "photos",
    targetField: "photos",
    multiple: true,
    maxFiles: 8,
    asPhotoObjects: true,
    jsonFields: [
      "location",
      "specializations",
      "amenities",
      "timings",
      "holidays",
      "acceptedInsurancePlans",
      "localizedName",
    ],
    numberFields: ["startingConsultationFee"],
    booleanFields: ["isVerified"],
    getBaseName: async (req) => {
      if (req.body.name) return String(req.body.name);
      const hospital = await HospitalModel.findById(req.params.id).select("name").lean();
      return hospital?.name ?? "hospital";
    },
  }),
  validate(updateHospitalSchema, "body"),
  asyncHandler(updateHospitalHandler),
);
router.delete("/:id/photos/:photoIndex", requireAuth, asyncHandler(deleteHospitalPhotoHandler));
router.delete("/:id", requireAuth, asyncHandler(deleteHospitalHandler));
router.post("/:id/verify", requireAuth, asyncHandler(verifyHospitalHandler));

export default router;
