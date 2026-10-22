import { Types } from "mongoose";
import { BloodDonorModel } from "./blood_donor.schema";
import type { BloodDonorDocument, BloodGroup } from "./blood_donor.interface";

export class BloodDonorRepository {
  create(data: Partial<BloodDonorDocument>): Promise<BloodDonorDocument> {
    return BloodDonorModel.create(data);
  }

  findById(id: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findById(id);
  }

  findActiveById(id: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findOne({ _id: id, isActive: true });
  }

  findByUserId(userId: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findOne({ userId: new Types.ObjectId(userId), isActive: true });
  }

  findByPhone(phone: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findOne({ phone, isActive: true });
  }

  updateByUserId(userId: string, data: Partial<BloodDonorDocument>): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), isActive: true },
      data,
      { new: true },
    );
  }

  updateById(id: string, data: Partial<BloodDonorDocument>): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findOneAndUpdate({ _id: id, isActive: true }, data, { new: true });
  }

  softDelete(id: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findByIdAndUpdate(
      id,
      { isActive: false, isAvailable: false, deletedAt: new Date() },
      { new: true },
    );
  }

  async search(params: {
    bloodGroup: BloodGroup;
    state?: string;
    city?: string;
    pincode?: string;
    origin?: [number, number];
    radiusKm: number;
    sort: "distance" | "recent";
    page: number;
    limit: number;
  }): Promise<{ donors: BloodDonorDocument[]; total: number }> {
    const baseFilter: Record<string, unknown> = {
      bloodGroup: params.bloodGroup,
      isAvailable: true,
      isActive: true,
    };

    // State + city + pincode — all required, apply AND (each field must match)
    if (params.state) {
      baseFilter.state = { $regex: `^${escapeRegex(params.state)}$`, $options: "i" };
    }
    if (params.city) {
      baseFilter.city = { $regex: `^${escapeRegex(params.city)}$`, $options: "i" };
    }
    if (params.pincode) {
      baseFilter.pincode = params.pincode;
    }

    const skip = (params.page - 1) * params.limit;

    if (params.origin) {
      const sortStage: Record<string, 1 | -1> =
        params.sort === "recent" ? { lastDonationDate: -1 } : { distanceMeters: 1 };
      const [result] = await BloodDonorModel.aggregate([
        {
          $geoNear: {
            near: { type: "Point", coordinates: params.origin },
            distanceField: "distanceMeters",
            maxDistance: params.radiusKm * 1000,
            spherical: true,
            query: baseFilter,
          },
        },
        { $sort: sortStage },
        {
          $facet: {
            donors: [{ $skip: skip }, { $limit: params.limit }],
            total: [{ $count: "count" }],
          },
        },
      ]);
      return {
        donors: (result?.donors ?? []) as BloodDonorDocument[],
        total: result?.total?.[0]?.count ?? 0,
      };
    }

    const sort: Record<string, 1 | -1> =
      params.sort === "recent" ? { lastDonationDate: -1 } : { createdAt: -1 };
    const [donors, total] = await Promise.all([
      BloodDonorModel.find(baseFilter).sort(sort).skip(skip).limit(params.limit),
      BloodDonorModel.countDocuments(baseFilter),
    ]);
    return { donors, total };
  }

  async listAdmin(filter: Record<string, unknown>, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [donors, total] = await Promise.all([
      BloodDonorModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      BloodDonorModel.countDocuments(filter),
    ]);
    return { donors, total };
  }

  incrementContactCount(id: string): Promise<BloodDonorDocument | null> {
    return BloodDonorModel.findByIdAndUpdate(
      id,
      { $inc: { "contactCount.today": 1, "contactCount.thisWeek": 1, "contactCount.total": 1 } },
      { new: true },
    );
  }

  analytics() {
    return BloodDonorModel.aggregate([
      { $match: { isActive: true } },
      {
        $facet: {
          byBloodGroup: [{ $group: { _id: "$bloodGroup", count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          byCity: [{ $group: { _id: "$city", count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                available: { $sum: { $cond: ["$isAvailable", 1, 0] } },
                verified: { $sum: { $cond: ["$isVerified", 1, 0] } },
              },
            },
          ],
        },
      },
    ]);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
