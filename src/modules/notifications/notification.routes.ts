import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  getUnreadCountHandler,
  listNotificationsHandler,
  markNotificationsReadHandler,
} from "./notification.controller";

const router = Router();

// Auth-only routes
router.get("/", requireAuth, asyncHandler(listNotificationsHandler));
router.post("/mark-read", requireAuth, asyncHandler(markNotificationsReadHandler));
router.get("/unread-count", requireAuth, asyncHandler(getUnreadCountHandler));

export const notificationRouter = router;
