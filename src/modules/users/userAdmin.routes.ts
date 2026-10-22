import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { UserModel } from "./user.schema";
import { NotFoundError, ValidationError } from "../../shared/errors";

const router = Router();

router.use(requireAuth, requireRole("content_admin", "platform_admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().optional(),
        role: z.enum(["user", "content_admin", "platform_admin"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);
    const filter: Record<string, unknown> = { deletedAt: null };
    if (query.role) filter.role = query.role;
    if (query.q) {
      filter.$or = [
        { phone: { $regex: query.q, $options: "i" } },
        { firstName: { $regex: query.q, $options: "i" } },
        { lastName: { $regex: query.q, $options: "i" } },
      ];
    }
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      UserModel.countDocuments(filter),
    ]);
    res.json({ data, pagination: { page: query.page, limit: query.limit, total } });
  }),
);

router.post(
  "/:id/ban",
  requireRole("platform_admin"),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!user) throw new NotFoundError("User not found");
    res.json({ data: user });
  }),
);

router.post(
  "/:id/unban",
  requireRole("platform_admin"),
  asyncHandler(async (req, res) => {
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true },
    );
    if (!user) throw new NotFoundError("User not found");
    res.json({ data: user });
  }),
);

// ── Donor management (admin only) ───────────────────────────────────────────

const donorUpdateSchema = z
  .object({
    isDonor: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    isContactVisible: z.boolean().optional(),
    stopAsDonor: z.boolean().optional(),
    donateCount: z.number().int().min(0).optional(),
    lastDonationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "lastDonationDate must be YYYY-MM-DD").optional(),
  })
  .strict();

/**
 * PUT /admin/users/:id/donor
 * Update donor-specific fields on a user (does NOT touch isActive or role)
 */
router.put(
  "/:id/donor",
  asyncHandler(async (req, res) => {
    const body = donorUpdateSchema.parse(req.body);

    const allowedFields = ["isDonor", "isAvailable", "isContactVisible", "stopAsDonor", "donateCount", "lastDonationDate"] as const;
    const update: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) update[field] = body[field];
    }

    if (Object.keys(update).length === 0) {
      throw new ValidationError("At least one donor field must be provided");
    }

    // If isDonor is being set to false, also reset related donor fields
    if (update.isDonor === false) {
      update.isAvailable = false;
      update.isContactVisible = false;
      update.eligibilitySelfDeclared = false;
      update.donorBloodGroup = null;
      update.stopAsDonor = false;
      update.isDonorVerified = false;
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { $set: update },
      { new: true },
    ).select("_id isDonor isAvailable isContactVisible stopAsDonor isDonorVerified donorBloodGroup donateCount lastDonationDate");

    if (!user) throw new NotFoundError("User not found");

    res.json({
      message: "Donor status updated",
      data: user,
    });
  }),
);

/**
 * PUT /admin/users/:id/donor/verify
 * Mark a user as a verified trusted donor
 */
router.put(
  "/:id/donor/verify",
  asyncHandler(async (req, res) => {
    const user = await UserModel.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null, isDonor: true },
      { $set: { isDonorVerified: true } },
      { new: true },
    ).select("_id isDonorVerified");

    if (!user) throw new NotFoundError("User not found or is not a donor");

    res.json({
      message: "Donor verified",
      data: user,
    });
  }),
);

export default router;
