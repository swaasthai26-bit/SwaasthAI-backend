import { doctorRepository } from "./doctor.repository";
import { HospitalModel } from "../hospitals/hospital.schema";
import type { DoctorDocument, DoctorResponse } from "./doctor.interface";

export class DoctorService {
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }
  private buildDoctorResponse(doctor: any) {
    // Extract consultationFee from primary affiliation for top-level access
    const primaryAff = (doctor.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
    return {
      id: doctor._id?.toString() || doctor.id,
      name: doctor.name,
      photo: doctor.photoUrl ?? null,
      qualification: doctor.qualification,
      specialization: doctor.primarySpecialization,
      languages: doctor.languages,
      experienceYears: doctor.experienceYears,
      registrationNumber: doctor.registrationNumber,
      bio: doctor.bio,
      gender: doctor.gender,
      consultationFee: primaryAff?.consultationFee ?? null,
      hospitalAffiliations: doctor.hospitalAffiliations.map((aff: any) => ({
        hospitalId: aff.hospitalId?._id?.toString() || aff.hospitalId,
        hospitalName: aff.hospitalId?.name,
        whatsappNumber: aff.hospitalId?.whatsappNumber ?? null,
        consultationFee: aff.consultationFee,
        isPrimary: aff.isPrimary,
        joinedAt: aff.joinedAt,
      })),
      availability: doctor.availability.map((avail: any) => ({
        hospitalId: avail.hospitalId?._id?.toString() || avail.hospitalId,
        dayOfWeek: avail.dayOfWeek,
        startTime: avail.startTime,
        endTime: avail.endTime,
      })),
      rating: doctor.rating,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    };
  }

  async getDoctorById(id: string): Promise<DoctorResponse | null> {
    const doctor = await doctorRepository.findById(id);
    if (!doctor) return null;
    return this.buildDoctorResponse(doctor);
  }

  async listDoctors(query?: {
    q?: string;
    specialization?: string[];
    gender?: string;
    minRating?: number;
    availableDate?: string;
    city?: string;
    page?: number;
    pageSize?: number;
    lat?: number;
    lng?: number;
  }) {
    // Resolve city → hospital IDs so we can filter doctors by their affiliated hospital city
    let hospitalIdsForCity: string[] | undefined;
    if (query?.city) {
      const hospitals = await HospitalModel.find({
        city: { $regex: query.city, $options: "i" },
        deletedAt: null,
      }).select("_id").lean();
      hospitalIdsForCity = hospitals.map((h: any) => h._id.toString());
      // No hospitals in this city → no doctors
      if (hospitalIdsForCity.length === 0) {
        return { data: [], pagination: { page: 1, pageSize: query?.pageSize || 20, total: 0, totalPages: 0 } };
      }
    }

    if (query && (query.q || query.specialization || query.gender || query.minRating !== undefined || query.page || query.pageSize || query.availableDate || hospitalIdsForCity)) {
      const result = await doctorRepository.search({ ...query, hospitalIds: hospitalIdsForCity ?? [] });
      return {
        data: result.doctors.map((d) => {
          const built = this.buildDoctorResponse(d);
          const primaryAff = (d.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
          const hospital = primaryAff?.hospitalId as any;
          let distanceKm: number | null = null;
          if (query.lat !== undefined && query.lng !== undefined && hospital?.location?.coordinates) {
            distanceKm = this.calculateDistance(query.lat, query.lng, hospital.location.coordinates[1], hospital.location.coordinates[0]);
          }
          return { ...built, distanceKm };
        }),
        pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages },
      };
    }
    const doctors = await doctorRepository.findAll();
    return doctors.map((d) => {
      const built = this.buildDoctorResponse(d);
      const primaryAff = (d.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
      const hospital = primaryAff?.hospitalId as any;
      let distanceKm: number | null = null;
      if (query?.lat !== undefined && query?.lng !== undefined && hospital?.location?.coordinates) {
        distanceKm = this.calculateDistance(query.lat!, query.lng!, hospital.location.coordinates[1], hospital.location.coordinates[0]);
      }
      return { ...built, distanceKm };
    });
  }

  async getDoctorsBySpecialization(specialization: string) {
    const doctors = await doctorRepository.findBySpecialization(specialization);
    return doctors.map((d) => this.buildDoctorResponse(d));
  }

  async getDoctorsByHospital(hospitalId: string) {
    const doctors = await doctorRepository.findByHospital(hospitalId);
    return doctors.map((d) => this.buildDoctorResponse(d));
  }

  async createDoctor(data: any): Promise<DoctorResponse> {
    const doctor = await doctorRepository.create(data);
    return this.buildDoctorResponse(doctor);
  }

  async updateDoctor(id: string, data: any): Promise<DoctorResponse | null> {
    const doctor = await doctorRepository.update(id, data);
    if (!doctor) return null;
    return this.buildDoctorResponse(doctor);
  }

  async deleteDoctor(id: string): Promise<void> {
    await doctorRepository.softDelete(id);
  }

  async typeaheadSearch(q: string, limit?: number, lat?: number, lng?: number) {
    const results = await doctorRepository.typeaheadSearch(q, limit);
    return results.map((d: any) => {
      const primaryAff = (d.hospitalAffiliations ?? []).find((a: any) => a.isPrimary);
      const hospital = primaryAff?.hospitalId; // populated: { location, city }

      let distanceKm: number | null = null;
      if (lat !== undefined && lng !== undefined && hospital?.location?.coordinates) {
        const [hLng, hLat] = hospital.location.coordinates;
        distanceKm = this.calculateDistance(lat, lng, hLat, hLng);
      }

      return {
        id: d._id?.toString(),
        name: d.name,
        specialization: d.primarySpecialization,
        photo: d.photoUrl ?? null,
        qualification: d.qualification ?? null,
        experienceYears: d.experienceYears ?? null,
        rating: d.rating ?? { avg: 0, count: 0 },
        consultationFee: primaryAff?.consultationFee ?? null,
        distanceKm,
      };
    });
  }
}

export const doctorService = new DoctorService();
