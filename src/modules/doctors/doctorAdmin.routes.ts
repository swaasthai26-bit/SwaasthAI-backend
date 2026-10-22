import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../shared/errors";
import {
  createDoctorHandler,
  deleteDoctorHandler,
  updateDoctorHandler,
} from "./doctor.controller";
import { createDoctorSchema, updateDoctorSchema } from "./doctor.zod";
import { DoctorModel } from "./doctor.schema";

const router = Router();

router.use(requireAuth, requireRole("content_admin", "platform_admin"));
router.post(
  "/",
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
router.delete("/:id", asyncHandler(deleteDoctorHandler));
router.post(
  "/import",
  asyncHandler(async (_req, res) => {
    throw new AppError(
      500,
      "NOT_IMPLEMENTED",
      "Doctor CSV import worker is not implemented yet",
    );
  }),
);

export default router;
