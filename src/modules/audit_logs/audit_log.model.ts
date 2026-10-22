import { model, Schema } from "mongoose";

const AuditLogSchema = new Schema(
  {
    actorUserId: { type: String, index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: String, index: true },
    beforeState: { type: Schema.Types.Mixed },
    afterState: { type: Schema.Types.Mixed },
    reason: { type: String },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ targetId: 1, targetType: 1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLogModel = model("AuditLog", AuditLogSchema);
