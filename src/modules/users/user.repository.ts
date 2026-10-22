import { UserDocument } from "./user.interface";
import { UserModel } from "./user.schema";

export async function findUserByPhone(phone: string): Promise<UserDocument | null> {
  return UserModel.findOne({ phone, deletedAt: null }).exec();
}

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  return UserModel.findOne({ email: email.toLowerCase().trim(), deletedAt: null }).exec();
}

export async function findUserById(id: string): Promise<UserDocument | null> {
  return UserModel.findOne({ _id: id, deletedAt: null }).exec();
}

export async function createUserWithPhone(phone: string): Promise<UserDocument> {
  return UserModel.create({
    phone,
    role: "user",
    isPhoneVerified: true,
    isEmailVerified: false,
    isActive: true,
  });
}

export async function createUserWithEmail(email: string): Promise<UserDocument> {
  return UserModel.create({
    email: email.toLowerCase().trim(),
    role: "user",
    isPhoneVerified: false,
    isEmailVerified: true,
    isActive: true,
  });
}

export async function updateUserById(
  id: string,
  update: Partial<UserDocument> | Record<string, unknown>,
): Promise<UserDocument | null> {
  const usesOperator = Object.keys(update).some((key) => key.startsWith("$"));
  return UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    usesOperator ? update : { $set: update },
    { new: true, runValidators: true },
  ).exec();
}

export async function softDeleteUser(id: string): Promise<UserDocument | null> {
  return UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), isActive: false } },
    { new: true },
  ).exec();
}
