import { model, Schema } from "mongoose";
import type { NotificationDocument } from "./notification.interface";

const NotificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    isRead: { type: Boolean, required: true, default: false, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel = model<NotificationDocument>(
  "Notification",
  NotificationSchema,
);
