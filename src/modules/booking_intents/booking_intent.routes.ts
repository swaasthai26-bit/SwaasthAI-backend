import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/requireAuth";
import { ForbiddenError } from "../../shared/errors";
import { bookingIntentService } from "./booking_intent.service";

const router = Router();

const createSchema = z.object({
  hospitalId: z.string().min(1),
  doctorId: z.string().min(1).optional(),
  source: z
    .enum(["hospital_profile", "doctor_profile", "search_result"])
    .default("doctor_profile"),
});

const listSchema = z.object({
  userId: z.string().optional(),
  hospitalId: z.string().optional(),
  doctorId: z.string().optional(),
  /** Free-text search: matched against user phone / firstName / lastName */
  q: z.string().optional(),
  /** ISO date (YYYY-MM-DD) — include intents created on or after this date */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
  /** ISO date (YYYY-MM-DD) — include intents created on or before this date */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Schema for the export endpoint — same filters, no pagination
const exportSchema = z.object({
  userId: z.string().optional(),
  hospitalId: z.string().optional(),
  doctorId: z.string().optional(),
  q: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
});

// ── User-facing: create a booking intent ────────────────────────────────────
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const input = createSchema.parse(req.body);
    const result = await bookingIntentService.create({
      userId: req.user.id,
      hospitalId: input.hospitalId,
      doctorId: input.doctorId,
      source: input.source,
    });
    res.status(200).json(result);
  }),
);

// ── User-facing: list own intents ────────────────────────────────────────────
router.get(
  "/my",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const query = listSchema.omit({ userId: true, q: true }).parse(req.query);
    const result = await bookingIntentService.listMine(req.user.id, query);
    res.json(result);
  }),
);

// ── Admin: list all intents (also handles non-admin fallback) ────────────────
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const isAdminMount = req.baseUrl.includes("/admin/booking-intents");
    if (isAdminMount) {
      if (!["content_admin", "platform_admin"].includes(req.user.role)) {
        throw new ForbiddenError("Insufficient permissions");
      }
      const query = listSchema.parse(req.query);
      res.json(await bookingIntentService.list(query));
      return;
    }

    const query = listSchema.omit({ userId: true, q: true }).parse(req.query);
    res.json(await bookingIntentService.listMine(req.user.id, query));
  }),
);

// ── Admin: analytics ─────────────────────────────────────────────────────────
router.get(
  "/analytics",
  requireAuth,
  requireRole("content_admin", "platform_admin"),
  asyncHandler(async (_req, res) => {
    const result = await bookingIntentService.analytics();
    res.json(result);
  }),
);

// ── Admin: export as CSV ─────────────────────────────────────────────────────
router.get(
  "/export",
  requireAuth,
  requireRole("content_admin", "platform_admin"),
  asyncHandler(async (req: any, res) => {
    const query = exportSchema.parse(req.query);
    const csv = await bookingIntentService.exportCsv(query);

    const filename = `booking-intents-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // BOM for Excel compatibility with UTF-8
    res.send("\uFEFF" + csv);
  }),
);

// ── User-facing: re-open an old intent ───────────────────────────────────────
router.get(
  "/:id/reopen",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const result = await bookingIntentService.reopen(req.params.id, req.user.id);
    res.json(result);
  }),
);

// ── User-facing: get a single intent ─────────────────────────────────────────
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req: any, res) => {
    const result = await bookingIntentService.getMine(req.params.id, req.user.id);
    res.json(result);
  }),
);

export const bookingIntentRouter = router;
