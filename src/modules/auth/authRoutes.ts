import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { validate } from "../../middleware/validate";
import {
  googleAuthHandler,
  logoutAllHandler,
  logoutHandler,
  refreshHandler,
  sendOtpHandler,
  verifyOtpHandler,
} from "./authController";
import { googleAuthSchema, logoutSchema, refreshSchema, sendOtpSchema, verifyOtpSchema } from "./auth.zod";

const router = Router();

router.post("/otp/send", validate(sendOtpSchema, "body"), asyncHandler(sendOtpHandler));
router.post("/otp/verify", validate(verifyOtpSchema, "body"), asyncHandler(verifyOtpHandler));
router.post("/google", validate(googleAuthSchema, "body"), asyncHandler(googleAuthHandler));
router.post("/refresh", validate(refreshSchema, "body"), asyncHandler(refreshHandler));
router.post("/logout", validate(logoutSchema, "body"), asyncHandler(logoutHandler));
router.post("/logout-all", asyncHandler(logoutAllHandler));

export default router;
