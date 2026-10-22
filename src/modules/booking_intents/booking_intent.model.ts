import { model, Schema } from "mongoose";

const BookingIntentSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    hospitalId: { type: String, required: true, index: true },
    doctorId: { type: String, default: null, index: true },
    whatsappNumberUsed: { type: String, required: true },
    contactMethod: {
      type: String,
      enum: ["whatsapp", "call"],
      required: true,
      default: "whatsapp",
    },
    contactValue: { type: String, required: true },
    messageTemplate: { type: String, required: true },
    source: {
      type: String,
      enum: ["hospital_profile", "doctor_profile", "search_result"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

BookingIntentSchema.index({ userId: 1, createdAt: -1 });
BookingIntentSchema.index({ hospitalId: 1, createdAt: -1 });
BookingIntentSchema.index({ userId: 1, hospitalId: 1, createdAt: -1 });
BookingIntentSchema.index({ createdAt: -1 });

export const BookingIntentModel = model("BookingIntent", BookingIntentSchema);
