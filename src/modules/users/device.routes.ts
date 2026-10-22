import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  registerFcmTokenHandler,
  unregisterFcmTokenHandler,
} from "./user.controller";

const router = Router();

router.post("/register", requireAuth, asyncHandler(registerFcmTokenHandler));
router.delete("/:deviceId", requireAuth, asyncHandler(unregisterFcmTokenHandler));

export default router;
