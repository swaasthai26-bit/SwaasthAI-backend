import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { doctorService } from "./doctor.service";
import { validated } from "../../middleware/validate";
import { AuthError } from "../../shared/errors";
import { recordView } from "../recently_viewed/recently_viewed.service";
import type { CreateDoctorInput, UpdateDoctorInput } from "./doctor.zod";

export async function getDoctorHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { id } = req.params as { id: string };
  const doctor = await doctorService.getDoctorById(id);
  if (!doctor) {
    throw new AuthError("Doctor not found", "NOT_FOUND");
  }
  // Fire-and-forget: record view for logged-in users only
  if (req.user?.id) {
    recordView(req.user.id, "doctor", id);
  }
  res.json(doctor);
}

export async function listDoctorsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { q, specialization, gender, minRating, page, pageSize, lat, lng, availableDate, city } = req.query as any;
  const result = await doctorService.listDoctors({
    q: q?.toString(),
    specialization: specialization
      ? specialization.toString().split(",").map((s: string) => s.trim())
      : undefined,
    gender: gender?.toString(),
    minRating: minRating !== undefined ? parseFloat(minRating) : undefined,
    page: page ? parseInt(page) : undefined,
    pageSize: pageSize ? parseInt(pageSize) : undefined,
    lat: lat !== undefined ? parseFloat(lat) : undefined,
    lng: lng !== undefined ? parseFloat(lng) : undefined,
    availableDate: availableDate?.toString(),
    city: city?.toString(),
  });
  res.json(result);
}

export async function getDoctorsByHospitalHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const { hospitalId } = req.params as { hospitalId: string };
  const doctors = await doctorService.getDoctorsByHospital(hospitalId);
  res.json(doctors);
}

export async function createDoctorHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can create
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const data = validated<CreateDoctorInput>(req);
  const doctor = await doctorService.createDoctor(data);
  res.status(200).json(doctor);
}

export async function updateDoctorHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can update
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const { id } = req.params as { id: string };
  const data = validated<UpdateDoctorInput>(req);
  const doctor = await doctorService.updateDoctor(id, data);
  if (!doctor) {
    throw new AuthError("Doctor not found", "NOT_FOUND");
  }
  res.json(doctor);
}

export async function deleteDoctorHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  // Only admins can delete
  if (
    req.user?.role !== "content_admin" &&
    req.user?.role !== "platform_admin"
  ) {
    throw new AuthError("Forbidden", "FORBIDDEN");
  }

  const { id } = req.params as { id: string };
  await doctorService.deleteDoctor(id);
  res.json({ message: "Doctor deleted" });
}
