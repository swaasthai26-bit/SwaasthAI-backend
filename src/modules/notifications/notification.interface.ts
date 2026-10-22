import { Document } from "mongoose";

export interface NotificationDocument extends Document {
  userId: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  category: string;
  metadata?: Record<string, unknown>;
}
