import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../shared/errors";
import {
  createHospitalHandler,
  deleteHospitalHandler,
  deleteHospitalPhotoHandler,
  listHospitalsHandler,
  updateHospitalHandler,
  verifyHospitalHandler,
} from "./hospital.controller";
import { createHospitalSchema, searchHospitalSchema, updateHospitalSchema } from "./hospital.zod";
import { HospitalModel } from "./hospital.schema";

const router = Router();

router.use(requireAuth, requireRole("content_admin", "platform_admin"));
router.get("/", validate(searchHospitalSchema, "query"), asyncHandler(listHospitalsHandler));
router.post(
  "/",
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
router.delete("/:id/photos/:photoIndex", asyncHandler(deleteHospitalPhotoHandler));
router.delete("/:id", asyncHandler(deleteHospitalHandler));
router.post("/:id/verify", asyncHandler(verifyHospitalHandler));
router.post("/import", asyncHandler(async (_req, res) => {
  throw new AppError(500, "NOT_IMPLEMENTED", "Hospital CSV import worker is not implemented yet");
}));

export default router;
