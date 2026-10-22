import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { UserModel } from "../users/user.schema";
import { HospitalModel } from "../hospitals/hospital.schema";
import { DoctorModel } from "../doctors/doctor.schema";
import { BloodDonorModel } from "../blood_donor/blood_donor.schema";
import { BookingIntentModel } from "../booking_intents/booking_intent.model";
import { ReviewModel } from "../reviews/review.model";
import { AuditLogModel } from "../audit_logs/audit_log.model";

const router = Router();

router.use(requireAuth, requireRole("content_admin", "platform_admin"));

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const [
      users,
      activeHospitals,
      pendingHospitals,
      doctors,
      bloodDonors,
      bookingIntents,
      pendingReviews,
    ] = await Promise.all([
      UserModel.countDocuments({ deletedAt: null }),
      HospitalModel.countDocuments({ deletedAt: null, isVerified: true, status: "active" }),
      HospitalModel.countDocuments({ deletedAt: null, $or: [{ isVerified: false }, { status: { $ne: "active" } }] }),
      DoctorModel.countDocuments({ deletedAt: null }),
      BloodDonorModel.countDocuments({ isActive: true }),
      BookingIntentModel.countDocuments(),
      ReviewModel.countDocuments({ adminStatus: "pending" }),
    ]);
    res.json({
      data: {
        users,
        hospitals: activeHospitals,
        pendingHospitals,
        totalHospitals: activeHospitals + pendingHospitals,
        doctors,
        bloodDonors,
        bookingIntents,
        pendingReviews,
      },
    });
  }),
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        actorUserId: z.string().optional(),
        targetId: z.string().optional(),
        targetType: z.string().optional(),
        action: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);
    const filter: Record<string, unknown> = {};
    if (query.actorUserId) filter.actorUserId = query.actorUserId;
    if (query.targetId) filter.targetId = query.targetId;
    if (query.targetType) filter.targetType = query.targetType;
    if (query.action) filter.action = query.action;
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      AuditLogModel.countDocuments(filter),
    ]);
    res.json({ data, pagination: { page: query.page, limit: query.limit, total } });
  }),
);

export default router;
