import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { validate } from "../../middleware/validate";
import {
  addFamilyMemberHandler,
  deleteFamilyMemberPhotoHandler,
  deleteFamilyMemberHandler,
  deleteMeHandler,
  deleteMyPhotoHandler,
  getFamilyMembersHandler,
  getMeHandler,
  registerFcmTokenHandler,
  saveHospitalHandler,
  sendChangePhoneOtpHandler,
  unsaveHospitalHandler,
  unregisterFcmTokenHandler,
  verifyChangePhoneOtpHandler,
  updateFamilyMemberHandler,
  updateMeHandler,
  updatePreferencesHandler,
} from "./user.controller";
import {
  getRecentlyViewedHandler,
  clearRecentlyViewedHandler,
} from "../recently_viewed/recently_viewed.controller";
import { updateMeSchema } from "./user.zod";
import { getMe } from "./user.service";

const router = Router();

router.get("/", requireAuth, asyncHandler(getMeHandler));
router.put(
  "/",
  requireAuth,
  validate(updateMeSchema, "body"),
  asyncHandler(updateMeHandler),
);
router.delete("/", requireAuth, asyncHandler(deleteMeHandler));
router.post(
  "/change-phone/otp/send",
  requireAuth,
  asyncHandler(sendChangePhoneOtpHandler),
);
router.post(
  "/change-phone/otp/verify",
  requireAuth,
  asyncHandler(verifyChangePhoneOtpHandler),
);
router.post(
  "/family-members",
  requireAuth,
  multipartImageUpload({
    fileField: "photo",
    targetField: "photoUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a family member profile image",
    optionalIfAbsent: true,
    getBaseName: (req) => String(req.body.name ?? "family_member"),
  }),
  asyncHandler(addFamilyMemberHandler),
);
router.get(
  "/family-members",
  requireAuth,
  asyncHandler(getFamilyMembersHandler),
);
router.put(
  "/family-members/:id",
  requireAuth,
  multipartImageUpload({
    fileField: "photo",
    targetField: "photoUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a family member profile image",
    optionalIfAbsent: true,
    getBaseName: (req) => String(req.body.name ?? "family_member"),
  }),
  asyncHandler(updateFamilyMemberHandler),
);
router.delete(
  "/family-members/:id/photo",
  requireAuth,
  asyncHandler(deleteFamilyMemberPhotoHandler),
);
router.delete(
  "/family-members/:id",
  requireAuth,
  asyncHandler(deleteFamilyMemberHandler),
);
router.post(
  "/saved/hospitals/:id",
  requireAuth,
  asyncHandler(saveHospitalHandler),
);
router.delete(
  "/saved/hospitals/:id",
  requireAuth,
  asyncHandler(unsaveHospitalHandler),
);
router.put("/preferences", requireAuth, asyncHandler(updatePreferencesHandler));
router.post("/fcm-tokens", requireAuth, asyncHandler(registerFcmTokenHandler));
router.delete(
  "/fcm-tokens/:deviceId",
  requireAuth,
  asyncHandler(unregisterFcmTokenHandler),
);
router.post(
  "/photo",
  requireAuth,
  multipartImageUpload({
    fileField: "photo",
    targetField: "photoUrl",
    minFiles: 1,
    minFilesMessage: "Please upload a profile image",
    getBaseName: async (req: any) => {
      const user = await getMe(req.user.id);
      return (
        [user.firstName, user.lastName].filter(Boolean).join("_") ||
        user.phone ||
        req.user.id
      );
    },
  }),
  asyncHandler(updateMeHandler),
);
router.delete("/photo", requireAuth, asyncHandler(deleteMyPhotoHandler));
// Recently Viewed
router.get("/recently-viewed", requireAuth, asyncHandler(getRecentlyViewedHandler));
router.delete("/recently-viewed", requireAuth, asyncHandler(clearRecentlyViewedHandler));

export const meRouter = router;
