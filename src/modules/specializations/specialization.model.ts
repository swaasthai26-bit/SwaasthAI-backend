import { model, Schema, type Document } from "mongoose";

export interface SpecializationDocument extends Document {
  key: string;
  label: string;
  iconKey: string;
  imageUrl?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SpecializationSchema = new Schema<SpecializationDocument>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    iconKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: undefined,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

export const SpecializationModel = model<SpecializationDocument>(
  "Specialization",
  SpecializationSchema,
);
