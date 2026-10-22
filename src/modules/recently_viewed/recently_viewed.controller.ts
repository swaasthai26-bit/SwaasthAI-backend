import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { AuthError } from "../../shared/errors";
import {
  clearRecentlyViewed,
  getRecentlyViewed,
} from "./recently_viewed.service";

export async function getRecentlyViewedHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AuthError("Authentication required", "AUTH_REQUIRED");

  const { lat, lng, limit } = req.query as any;
  const latitude = lat ? parseFloat(lat) : undefined;
  const longitude = lng ? parseFloat(lng) : undefined;
  const limitNum = limit ? Math.max(1, Math.min(20, parseInt(limit))) : 6;

  const data = await getRecentlyViewed(req.user.id, latitude, longitude);
  const sliced = data.slice(0, limitNum);

  res.json({
    status: true,
    message: "Data fetched successfully",
    data: sliced,
  });
}

export async function clearRecentlyViewedHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) throw new AuthError("Authentication required", "AUTH_REQUIRED");
  await clearRecentlyViewed(req.user.id);
  res.json({ message: "Recently viewed cleared" });
}
