import { model, Schema } from "mongoose";

const ReviewSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    targetType: { type: String, enum: ["hospital", "doctor"], required: true },
    relatedBookingIntentId: { type: String, default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 1000 },
    photos: { type: [String], default: [] },
    hasBookingIntent: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    flagReasons: { type: [String], default: [] },
    flagCount: { type: Number, default: 0 },
    adminStatus: {
      type: String,
      enum: ["pending", "approved", "removed"],
      default: "pending",
      index: true,
    },
    hospitalResponse: {
      text: { type: String, trim: true },
      respondedAt: Date,
      respondedBy: String,
    },
    editedAt: Date,
  },
  { timestamps: true },
);

ReviewSchema.index({ targetId: 1, targetType: 1, adminStatus: 1, createdAt: -1 });
ReviewSchema.index(
  { userId: 1, targetId: 1, targetType: 1 },
  { unique: true, name: "uniq_review_user_target" },
);
ReviewSchema.index({ adminStatus: 1, createdAt: -1 });

export const ReviewModel = model("Review", ReviewSchema);
