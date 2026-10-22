import { DoctorModel } from "./doctor.schema";
import type { DoctorDocument } from "./doctor.interface";

export class DoctorRepository {
  async create(data: any): Promise<DoctorDocument> {
    return DoctorModel.create(data);
  }

  async findById(id: string): Promise<DoctorDocument | null> {
    return DoctorModel.findOne({ _id: id, deletedAt: null }).populate(
      "hospitalAffiliations.hospitalId availability.hospitalId",
    );
  }

  async findAll(): Promise<DoctorDocument[]> {
    return DoctorModel.find({ deletedAt: null, isActive: true }).populate(
      "hospitalAffiliations.hospitalId availability.hospitalId",
    );
  }

  async findBySpecialization(
    specialization: string,
  ): Promise<DoctorDocument[]> {
    return DoctorModel.find({
      primarySpecialization: specialization,
      deletedAt: null,
      isActive: true,
    }).populate("hospitalAffiliations.hospitalId availability.hospitalId");
  }

  async findByHospital(hospitalId: string): Promise<DoctorDocument[]> {
    return DoctorModel.find({
      "hospitalAffiliations.hospitalId": hospitalId,
      deletedAt: null,
      isActive: true,
    }).populate("hospitalAffiliations.hospitalId availability.hospitalId");
  }

  async update(id: string, data: any): Promise<DoctorDocument | null> {
    return DoctorModel.findByIdAndUpdate(id, data, { new: true }).populate(
      "hospitalAffiliations.hospitalId availability.hospitalId",
    );
  }

  async softDelete(id: string): Promise<DoctorDocument | null> {
    return DoctorModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );
  }

  async search(query: {
    q?: string;
    specialization?: string[];
    gender?: string;
    minRating?: number;
    availableDate?: string;
    hospitalIds?: string[];
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const filters: any = { deletedAt: null, isActive: true };

    if (query.q) {
      filters.$or = [
        { name: { $regex: query.q, $options: "i" } },
        { primarySpecialization: { $regex: query.q, $options: "i" } },
        { qualification: { $regex: query.q, $options: "i" } },
      ];
    }
    if (query.specialization && query.specialization.length > 0) {
      filters.primarySpecialization = { $in: query.specialization };
    }
    if (query.gender) {
      filters.gender = query.gender;
    }
    if (query.minRating !== undefined) {
      filters["rating.avg"] = { $gte: query.minRating };
    }
    // availableDate: filter doctors available on that day of week
    if (query.availableDate) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = dayNames[new Date(query.availableDate).getDay()];
      if (dayOfWeek) {
        filters["availability.dayOfWeek"] = dayOfWeek;
      }
    }
    // city: filter by affiliated hospital IDs
    if (query.hospitalIds && query.hospitalIds.length > 0) {
      filters["hospitalAffiliations.hospitalId"] = { $in: query.hospitalIds };
    }

    const [doctors, total] = await Promise.all([
      DoctorModel.find(filters)
        .sort({ "rating.avg": -1, "rating.count": -1 })
        .skip(skip)
        .limit(pageSize)
        .populate("hospitalAffiliations.hospitalId availability.hospitalId"),
      DoctorModel.countDocuments(filters),
    ]);

    return {
      doctors,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async typeaheadSearch(q: string, limit: number = 10) {
    return DoctorModel.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { primarySpecialization: { $regex: q, $options: "i" } },
        { qualification: { $regex: q, $options: "i" } },
        { bio: { $regex: q, $options: "i" } },
      ],
      deletedAt: null,
      isActive: true,
    })
      .limit(limit)
      .select("name primarySpecialization photoUrl qualification experienceYears rating hospitalAffiliations")
      .populate("hospitalAffiliations.hospitalId", "location city")
      .lean();
  }
}

export const doctorRepository = new DoctorRepository();
