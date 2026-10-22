import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { multipartImageUpload } from "../../middleware/fileUpload";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { ReviewModel } from "./review.model";

const router = Router();

const createReviewSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(["hospital", "doctor"]),
  relatedBookingIntentId: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(1000).optional(),
  photos: z.array(z.string().url()).max(3).default([]),
});

const moderateSchema = z.object({
  adminStatus: z.enum(["approved", "removed"]),
  flagReason: z.string().optional(),
});

const listReviewQuerySchema = z
  .object({
    targetId: z.string().min(1).optional(),
    targetType: z.enum(["hospital", "doctor"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((query) => !query.targetId || query.targetType, {
    message: "targetType is required when targetId is provided",
  });

const updateReviewSchema = z
  .object({
    targetId: z.string().min(1).optional(),
    targetType: z.enum(["hospital", "doctor"]).optional(),
    relatedBookingIntentId: z.string().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    text: z.string().trim().max(1000).optional(),
    photos: z.array(z.string().url()).max(3).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field must be provided",
  });

const flagReviewSchema = z
  .object({
    reason: z.string().trim().min(2).max(200),
  })
  .strict();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listReviewQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { adminStatus: "approved" };
    if (query.targetId) filter.targetId = query.targetId;
    if (query.targetType) filter.targetType = query.targetType;
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
      ReviewModel.countDocuments(filter),
    ]);
    res.json({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  }),
);

router.get(
  "/:targetType/:targetId",
  asyncHandler(async (req, res) => {
    const data = await ReviewModel.find({
      targetType: req.params.targetType,
      targetId: req.params.targetId,
      adminStatus: "approved",
    }).sort({ createdAt: -1 });
    res.json({ data });
  }),
);

router.post(
  "/",
  requireAuth,
  multipartImageUpload({
    fileField: "photos",
    targetField: "photos",
    multiple: true,
    minFiles: 1,
    maxFiles: 3,
    minFilesMessage: "Please upload at least one review image",
    optionalIfAbsent: true,
    numberFields: ["rating"],
    getBaseName: (req) =>
      `${req.body.targetType ?? "review"}_${req.body.targetId ?? "photo"}`,
  }),
  asyncHandler(async (req: any, res) => {
    const input = createReviewSchema.parse(req.body);
    const review = await ReviewModel.findOneAndUpdate(
      {
        userId: req.user.id,
        targetId: input.targetId,
        targetType: input.targetType,
      },
      {
        ...input,
        userId: req.user.id,
        hasBookingIntent: Boolean(input.relatedBookingIntentId),
        adminStatus: "pending",
        editedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.status(200).json({ data: review });
  }),
);

router.put(
  "/:id",
  requireAuth,
  multipartImageUpload({
    fileField: "photos",
    targetField: "photos",
    multiple: true,
    maxFiles: 3,
    numberFields: ["rating"],
    getBaseName: (req) => `review_${req.params.id}`,
  }),
  asyncHandler(async (req: any, res) => {
    const input = updateReviewSchema.parse(req.body);
    const review: any = await ReviewModel.findById(req.params.id);
    if (!review) throw new NotFoundError("Review not found");
    if (review.userId !== req.user.id)
      throw new ForbiddenError("You can edit only your own review");
    const createdAt = new Date(review.createdAt).getTime();
    if (Date.now() - createdAt > 24 * 60 * 60 * 1000) {
      throw new ForbiddenError("Reviews can be edited only within 24 hours");
    }
    Object.assign(review, input, {
      hasBookingIntent: input.relatedBookingIntentId
        ? true
        : review.hasBookingIntent,
      editedAt: new Date(),
      adminStatus: "pending",
    });
    await review.save();
    res.json({ data: review });
  }),
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const review: any = await ReviewModel.findById(req.params.id);
    if (!review) throw new NotFoundError("Review not found");
    if (review.userId !== req.user.id)
      throw new ForbiddenError("You can delete only your own review");
    await review.deleteOne();
    res.status(200).json({ message: "Review deleted successfully" });
  }),
);

router.post(
  "/:id/flag",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = flagReviewSchema.parse(req.body);
    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      {
        isFlagged: true,
        $push: { flagReasons: input.reason },
        $inc: { flagCount: 1 },
      },
      { new: true },
    );
    if (!review) throw new NotFoundError("Review not found");
    res.json({ data: review });
  }),
);

router.get(
  "/admin/moderation",
  requireAuth,
  requireRole("content_admin", "platform_admin"),
  asyncHandler(async (_req, res) => {
    const data = await ReviewModel.find().sort({ createdAt: -1 }).limit(100);
    res.json({ data });
  }),
);

router.post(
  "/admin/:id/moderate",
  requireAuth,
  requireRole("content_admin", "platform_admin"),
  asyncHandler(async (req, res) => {
    const input = moderateSchema.parse(req.body);
    const review = await ReviewModel.findByIdAndUpdate(
      req.params.id,
      {
        adminStatus: input.adminStatus,
        ...(input.flagReason
          ? {
              $push: { flagReasons: input.flagReason },
              isFlagged: true,
              $inc: { flagCount: 1 },
            }
          : {}),
      },
      { new: true },
    );
    res.json({ data: review });
  }),
);

export const reviewRouter = router;
