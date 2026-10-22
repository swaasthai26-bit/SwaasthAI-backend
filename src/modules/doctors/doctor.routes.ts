import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth } from "../../middleware/requireAuth";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { ReviewModel } from "../reviews/review.model";
import { DoctorModel } from "./doctor.schema";
import {
  getDoctorHandler,
  getDoctorsByHospitalHandler,
  listDoctorsHandler,
  createDoctorHandler,
  updateDoctorHandler,
  deleteDoctorHandler,
} from "./doctor.controller";
import { createDoctorSchema, updateDoctorSchema } from "./doctor.zod";

const router = Router();

// Public routes
router.get("/", asyncHandler(listDoctorsHandler));
router.get("/hospital/:hospitalId", asyncHandler(getDoctorsByHospitalHandler));
router.get(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const data = await ReviewModel.find({
      targetType: "doctor",
      targetId: req.params.id,
      adminStatus: "approved",
    }).sort({ createdAt: -1 });
    res.json({ data });
  }),
);
router.get("/:id", optionalAuth, asyncHandler(getDoctorHandler));

// Admin-only routes
router.post(
  "/",
  requireAuth,
  multipartImageUpload({
    fileField: "photo",
    targetField: "photoUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a doctor profile image",
    optionalIfAbsent: true,
    jsonFields: ["languages", "hospitalAffiliations", "availability"],
    numberFields: ["experienceYears"],
    booleanFields: ["isActive"],
    getBaseName: (req) => String(req.body.name ?? "doctor"),
  }),
  validate(createDoctorSchema, "body"),
  asyncHandler(createDoctorHandler),
);
router.put(
  "/:id",
  requireAuth,
  multipartImageUpload({
    fileField: "photo",
    targetField: "photoUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a doctor profile image",
    optionalIfAbsent: true,
    jsonFields: ["languages", "hospitalAffiliations", "availability"],
    numberFields: ["experienceYears"],
    booleanFields: ["isActive"],
    getBaseName: async (req) => {
      if (req.body.name) return String(req.body.name);
      const doctor = await DoctorModel.findById(req.params.id)
        .select("name")
        .lean();
      return doctor?.name ?? "doctor";
    },
  }),
  validate(updateDoctorSchema, "body"),
  asyncHandler(updateDoctorHandler),
);
router.delete("/:id", requireAuth, asyncHandler(deleteDoctorHandler));

export default router;
