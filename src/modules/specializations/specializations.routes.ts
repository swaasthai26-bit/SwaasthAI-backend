import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { multipartImageUpload } from "../../middleware/fileUpload";
import {
  createSpecializationHandler,
  deleteSpecializationHandler,
  deleteSpecializationImageHandler,
  getSpecializationsHandler,
  updateSpecializationHandler,
} from "./specializations.controller";

const router = Router();

router.get("/", asyncHandler(getSpecializationsHandler));

export const specializationsRouter = router;

const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("content_admin", "platform_admin"));
adminRouter.post(
  "/",
  multipartImageUpload({
    fileField: "image",
    targetField: "imageUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a specialization image",
    optionalIfAbsent: true,
    getBaseName: (req) => String(req.body.key ?? "specialization"),
  }),
  asyncHandler(createSpecializationHandler),
);
adminRouter.put(
  "/:key",
  multipartImageUpload({
    fileField: "image",
    targetField: "imageUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a specialization image",
    optionalIfAbsent: true,
    getBaseName: (req) =>
      String(req.body.key ?? req.params.key ?? "specialization"),
  }),
  asyncHandler(updateSpecializationHandler),
);
adminRouter.delete(
  "/:key/image",
  asyncHandler(deleteSpecializationImageHandler),
);
adminRouter.delete("/:key", asyncHandler(deleteSpecializationHandler));

export const specializationAdminRouter = adminRouter;
