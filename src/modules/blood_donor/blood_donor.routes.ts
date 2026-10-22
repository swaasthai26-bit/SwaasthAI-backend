import { Router } from "express";
import type Redis from "ioredis";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { BloodDonorController } from "./blood_donor.controller";

export function createBloodDonorRoutes(redis?: Redis | null): Router {
  const router = Router();
  const controller = new BloodDonorController(redis);
  const adminOnly = [requireAuth, requireRole("content_admin", "platform_admin")];

  router.get("/blood-donors", controller.search);
  router.get("/blood-donors/:id", controller.detail);
  router.post("/blood-donors/:id/contact-link", requireAuth, controller.contactLink);

  router.get("/me/donor", requireAuth, controller.getMyProfile);
  router.put("/me/donor", requireAuth, controller.updateMyProfile);
  router.delete("/me/donor", requireAuth, controller.unregisterSelf);

  router.get("/admin/blood-donors/analytics", ...adminOnly, controller.adminAnalytics);
  router.post("/admin/blood-donors/import", ...adminOnly, controller.adminImport);
  router.get("/admin/blood-donors", ...adminOnly, controller.adminList);
  router.post("/admin/blood-donors", ...adminOnly, controller.adminCreate);
  router.get("/admin/blood-donors/:id", ...adminOnly, controller.adminDetail);
  router.put("/admin/blood-donors/:id", ...adminOnly, controller.adminUpdate);
  router.delete("/admin/blood-donors/:id", ...adminOnly, controller.adminDelete);
  router.put("/admin/blood-donors/:id/verify", ...adminOnly, controller.adminVerify);
  router.put("/admin/blood-donors/:id/suspend", ...adminOnly, controller.adminSuspend);

  return router;
}
