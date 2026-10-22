import type { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { AuthError } from "../../shared/errors";
import { notificationService } from "./notification.service";

export async function listNotificationsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  }
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(req.query);
  res.json(await notificationService.list(req.user.id, query.page, query.limit));
}

export async function getUnreadCountHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  }

  const count = await notificationService.getUnreadCount(req.user.id);
  res.json({ count });
}

export async function markNotificationsReadHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) {
    throw new AuthError("Authentication required", "AUTH_REQUIRED");
  }
  const input = z
    .object({
      notificationId: z.string().min(1).optional(),
      all: z.boolean().optional(),
    })
    .strict()
    .refine((value) => value.all || value.notificationId, {
      message: "Provide notificationId or all=true",
    })
    .parse(req.body);
  res.json(await notificationService.markRead(req.user.id, input.all ? undefined : input.notificationId));
}
