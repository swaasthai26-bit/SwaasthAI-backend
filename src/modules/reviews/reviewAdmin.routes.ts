import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { ReviewModel } from "./review.model";

const router = Router();

router.use(requireAuth, requireRole("content_admin", "platform_admin"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await ReviewModel.find().sort({ createdAt: -1 }).limit(100);
    res.json({ data });
  }),
);

router.post(
  "/:id/moderate",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        adminStatus: z.enum(["approved", "removed"]),
        flagReason: z.string().optional(),
      })
      .parse(req.body);
    const update: Record<string, unknown> = { adminStatus: input.adminStatus };
    if (input.flagReason) {
      update.isFlagged = true;
      update.$push = { flagReasons: input.flagReason };
      update.$inc = { flagCount: 1 };
    }
    const review = await ReviewModel.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ data: review });
  }),
);

export default router;
