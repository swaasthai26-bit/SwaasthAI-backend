import { UserModel } from "../modules/users/user.schema";
import { HospitalModel } from "../modules/hospitals/hospital.schema";
import { DoctorModel } from "../modules/doctors/doctor.schema";
import { BloodDonorModel } from "../modules/blood_donor/blood_donor.schema";
import { BookingIntentModel } from "../modules/booking_intents/booking_intent.model";
import { ReviewModel } from "../modules/reviews/review.model";
import { AuditLogModel } from "../modules/audit_logs/audit_log.model";

export async function initMongoIndexes(): Promise<void> {
  await UserModel.createIndexes();
  await HospitalModel.createIndexes();
  await DoctorModel.createIndexes();
  await BloodDonorModel.createIndexes();
  await BookingIntentModel.createIndexes();
  await ReviewModel.createIndexes();
  await AuditLogModel.createIndexes();
  console.log("MongoDB indexes initialized");
}
