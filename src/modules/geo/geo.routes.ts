import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  autocompletePlaces,
  distanceKm,
  resolveGeoPoint,
  reverseGeoPoint,
  STATES,
  STATE_MAP,
} from "./geo.utils";

const router = Router();

const resolveSchema = z
  .object({
    city: z.string().trim().min(2).optional(),
    pincode: z.string().trim().regex(/^\d{6}$/).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((data) => data.city || data.pincode || (data.lat !== undefined && data.lng !== undefined), {
    message: "Provide city, pincode, or lat/lng",
  });

const distanceSchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
});

const reverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const autocompleteSchema = z.object({
  q: z.string().trim().min(2),
});

// GET /geo/states
// Returns list of all states (key + label). No auth required.
router.get(
  "/states",
  asyncHandler(async (_req, res) => {
    res.json({
      data: STATES.map((s) => ({ key: s.key, label: s.label })),
    });
  }),
);

// GET /geo/states/:state/cities
// Returns all cities for the given state slug. No auth required.
// 404 if state not found.
router.get(
  "/states/:state/cities",
  asyncHandler(async (req, res) => {
    const stateKey = String(req.params.state).trim().toLowerCase();
    const state = STATE_MAP.get(stateKey);
    if (!state) {
      res.status(404).json({ status: false, message: "State not found" });
      return;
    }
    res.json({
      data: state.cities.map((c) => ({ key: c.key, label: c.label })),
    });
  }),
);

router.get(
  "/resolve",
  asyncHandler(async (req, res) => {
    const input = resolveSchema.parse(req.query);
    const point = resolveGeoPoint(input);
    res.json({ data: point });
  }),
);

router.get(
  "/distance",
  asyncHandler(async (req, res) => {
    const input = distanceSchema.parse(req.query);
    res.json({
      data: {
        distanceKm: distanceKm([input.fromLng, input.fromLat], [input.toLng, input.toLat]),
      },
    });
  }),
);

router.get(
  "/reverse",
  asyncHandler(async (req, res) => {
    const input = reverseSchema.parse(req.query);
    res.json({ data: reverseGeoPoint(input.lat, input.lng) });
  }),
);

router.get(
  "/autocomplete",
  asyncHandler(async (req, res) => {
    const input = autocompleteSchema.parse(req.query);
    res.json({ data: autocompletePlaces(input.q) });
  }),
);

export const geoRouter = router;
