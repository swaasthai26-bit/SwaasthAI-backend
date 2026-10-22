import { NotificationModel } from "./notification.model";
import type { CreateNotificationInput } from "./notification.interface";

export class NotificationService {
  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NotificationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments({ userId }),
    ]);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, isRead: false }).exec();
  }

  async markRead(userId: string, notificationId?: string) {
    const filter: Record<string, unknown> = { userId, isRead: false };
    if (notificationId) filter._id = notificationId;
    const result = await NotificationModel.updateMany(filter, { isRead: true });
    return { updatedCount: result.modifiedCount };
  }

  async createNotification(userId: string, data: CreateNotificationInput) {
    return NotificationModel.create({ userId, ...data });
  }
}

export const notificationService = new NotificationService();
