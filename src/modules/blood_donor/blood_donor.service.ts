import type Redis from "ioredis";
import { Types } from "mongoose";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitError } from "../../shared/errors";
import { UserModel } from "../users/user.schema";
import { DONOR_CONTACT_DAILY_LIMIT, DONOR_CONTACT_RATE_KEY, DONOR_ELIGIBILITY_DAYS } from "./blood_donor.constants";
import { BloodDonorRepository } from "./blood_donor.repository";
import type { BloodDonorDocument } from "./blood_donor.interface";
import type {
  AdminCreateDonorInput,
  AdminUpdateDonorInput,
  DonorSearchInput,
  RegisterDonorInput,
  UpdateMyDonorInput,
} from "./blood_donor.validation";
import {
  buildDonorWhatsAppMessage,
  buildWhatsAppLink,
  distanceKm,
  firstName,
  geocodeIndianLocation,
  normalizeIndianPhone,
  parseCsvRows,
  toPublicDonor,
} from "./blood_donor.utils";

const memoryContactSets = new Map<string, Set<string>>();

export class BloodDonorService {
  private repository = new BloodDonorRepository();

  constructor(private redis?: Redis | null) {}

  async registerSelf(userId: string, data: RegisterDonorInput) {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    // Age check only if DOB is set — if not set, allow registration
    if (user.dateOfBirth && getAge(user.dateOfBirth) < 18) {
      throw new ForbiddenError("Blood donors must be at least 18 years old");
    }
    // If already registered via User table
    if (user.isDonor) throw new ConflictError("You are already registered as a donor");

    // Update User table with donor fields (no separate BloodDonor record for self-registered)
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        isDonor: true,
        donorBloodGroup: data.bloodGroup,
        isAvailable: data.isAvailable ?? true,
        isContactVisible: false,
        lastDonationDate: data.lastDonationDate ? new Date(data.lastDonationDate) : null,
        eligibilitySelfDeclared: true,
        viewCount: 0,
        donateCount: 0,
        stopAsDonor: false,
        // Use city/pincode from request or fall back to profile address
        ...(data.city ? { "address.city": data.city } : {}),
        ...(data.state ? { "address.state": data.state } : {}),
        ...(data.pincode ? { "address.pincode": data.pincode } : {}),
      },
      { new: true },
    );
    if (!updatedUser) throw new NotFoundError("User not found");
    return updatedUser;
  }

  async getMyProfile(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user || !user.isDonor) throw new NotFoundError("Donor profile not found");
    return {
      isDonor: user.isDonor,
      donorBloodGroup: user.donorBloodGroup,
      city: user.address?.city ?? null,
      state: user.address?.state ?? null,
      pincode: user.address?.pincode ?? null,
      isAvailable: user.isAvailable,
      isContactVisible: user.isContactVisible,
      lastDonationDate: user.lastDonationDate,
      eligibilitySelfDeclared: user.eligibilitySelfDeclared,
      viewCount: user.viewCount ?? 0,
      donateCount: user.donateCount ?? 0,
      stopAsDonor: user.stopAsDonor,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Donor",
      phone: user.phone,
    };
  }

  async updateMyProfile(userId: string, data: UpdateMyDonorInput) {
    const update: Record<string, any> = {};

    // isDonor: true → register as donor, isDonor: false → unregister
    if (data.isDonor === true) {
      update.isDonor = true;
      update.isAvailable = data.isAvailable ?? false;
      update.isContactVisible = data.isContactVisible ?? false;
      update.eligibilitySelfDeclared = data.eligibilitySelfDeclared ?? false;
      update.viewCount = 0;
      update.donateCount = 0;
      update.stopAsDonor = false;
      if (data.bloodGroup !== undefined) update.donorBloodGroup = data.bloodGroup;
      if (data.lastDonationDate !== undefined) update.lastDonationDate = new Date(data.lastDonationDate);
      if (data.city !== undefined) update["address.city"] = data.city;
      if (data.state !== undefined) update["address.state"] = data.state;
      if (data.pincode !== undefined) update["address.pincode"] = data.pincode;
    } else if (data.isDonor === false) {
      update.isDonor = false;
      update.isAvailable = false;
      update.stopAsDonor = false;
      update.donorBloodGroup = null;
      update.eligibilitySelfDeclared = false;
    } else {
      // Partial update — just update whichever fields are sent
      if (data.bloodGroup !== undefined) update.donorBloodGroup = data.bloodGroup;
      if (data.isAvailable !== undefined) update.isAvailable = data.isAvailable;
      if (data.lastDonationDate !== undefined) update.lastDonationDate = new Date(data.lastDonationDate);
      if (data.eligibilitySelfDeclared !== undefined) update.eligibilitySelfDeclared = data.eligibilitySelfDeclared;
      if (data.city !== undefined) update["address.city"] = data.city;
      if (data.state !== undefined) update["address.state"] = data.state;
      if (data.pincode !== undefined) update["address.pincode"] = data.pincode;
      if (data.stopAsDonor !== undefined) update.stopAsDonor = data.stopAsDonor;
      if (data.isContactVisible !== undefined) update.isContactVisible = data.isContactVisible;
    }

    const updated = await UserModel.findByIdAndUpdate(userId, update, { new: true });
    if (!updated) throw new NotFoundError("User not found");
    return {
      isDonor: updated.isDonor ?? false,
      donorBloodGroup: updated.donorBloodGroup ?? null,
      city: updated.address?.city ?? null,
      state: updated.address?.state ?? null,
      pincode: updated.address?.pincode ?? null,
      isAvailable: updated.isAvailable ?? false,
      isContactVisible: updated.isContactVisible ?? false,
      stopAsDonor: updated.stopAsDonor ?? false,
      lastDonationDate: updated.lastDonationDate ?? null,
      eligibilitySelfDeclared: updated.eligibilitySelfDeclared ?? false,
      viewCount: updated.viewCount ?? 0,
      donateCount: updated.donateCount ?? 0,
    };
  }

  async toggleAvailability(userId: string, isAvailable: boolean) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { isAvailable },
      { new: true },
    );
    if (!user || !user.isDonor) throw new NotFoundError("Donor profile not found");
    return { isAvailable: user.isAvailable };
  }

  async updateLastDonation(userId: string, lastDonationDate: Date) {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { lastDonationDate },
      { new: true },
    );
    if (!user || !user.isDonor) throw new NotFoundError("Donor profile not found");
    return { lastDonationDate: user.lastDonationDate };
  }

  async unregisterSelf(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user || !user.isDonor) throw new NotFoundError("Donor profile not found");
    await UserModel.findByIdAndUpdate(userId, {
      isDonor: false,
      isAvailable: false,
      stopAsDonor: false,
      donorBloodGroup: null,
      eligibilitySelfDeclared: false,
    });
  }

  async search(query: DonorSearchInput) {
    const origin = query.lat !== undefined && query.lng !== undefined
      ? ([query.lng, query.lat] as [number, number])
      : undefined;

    // 1. Query User table (self-registered donors)
    const userFilter: Record<string, any> = {
      isDonor: true,
      isAvailable: true,
      stopAsDonor: false,
      deletedAt: null,
    };
    if (query.bloodGroup) userFilter.donorBloodGroup = query.bloodGroup;
    // All three are now required — apply AND logic (all must match)
    userFilter["address.state"] = { $regex: `^${escapeRegex(query.state)}$`, $options: "i" };
    userFilter["address.city"] = { $regex: `^${escapeRegex(query.city)}$`, $options: "i" };
    userFilter["address.pincode"] = query.pincode;

    const userDonors = await UserModel.find(userFilter).lean();

    // 2. Query BloodDonor table (admin-imported)
    const result = await this.repository.search({
      bloodGroup: query.bloodGroup,
      state: query.state,
      city: query.city,
      pincode: query.pincode,
      origin,
      radiusKm: query.radius ?? 25,
      sort: query.sort ?? "distance",
      page: 1,
      limit: 100, // get all for merging
    });

    // 3. Build user-table donor summaries
    const userDonorSummaries = userDonors.map((u: any) => {
      const city = u.address?.city ?? "";
      const donationDays = u.lastDonationDate
        ? Math.floor((Date.now() - new Date(u.lastDonationDate).getTime()) / 86400000)
        : null;
      let distanceKmVal: number | undefined;
      if (origin && u.address?.location?.coordinates) {
        distanceKmVal = distanceKm(origin, u.address.location.coordinates);
      }
      // Calculate age from dateOfBirth
      let age: number | null = null;
      if (u.dateOfBirth) {
        const dob = new Date(u.dateOfBirth);
        const now = new Date();
        age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      }
      return {
        id: u._id.toString(),
        source: "user" as const,
        firstName: u.firstName ?? "Donor",
        photo: u.photoUrl ?? null,
        bloodGroup: u.donorBloodGroup,
        city,
        state: u.address?.state ?? null,
        age,
        lastDonationDate: u.lastDonationDate ?? null,
        lastAvailableAt: u.updatedAt,
        daysSinceLastDonation: donationDays,
        mayBeEligible: donationDays === null || donationDays >= DONOR_ELIGIBILITY_DAYS,
        distanceKm: distanceKmVal,
        isVerified: false,
        isAvailable: u.isAvailable,
        isContactVisible: u.isContactVisible ?? false,
        // User-registered donors: always show phone (they registered themselves)
        phone: u.phone ?? null,
        viewCount: u.viewCount ?? 0,
        donateCount: u.donateCount ?? 0,
      };
    });

    // 4. BloodDonor table summaries — enrich with user data if userId is linked
    // Collect all linked userIds to batch-fetch user profiles
    const linkedUserIds = result.donors
      .filter((d) => d.userId)
      .map((d) => d.userId!.toString());
    const linkedUsersMap = new Map<string, any>();
    if (linkedUserIds.length > 0) {
      const linkedUsers = await UserModel.find({ _id: { $in: linkedUserIds } })
        .select("_id photoUrl phone firstName lastName dateOfBirth")
        .lean();
      for (const u of linkedUsers) {
        linkedUsersMap.set((u._id as any).toString(), u);
      }
    }

    const adminDonorSummaries = result.donors.map((donor) => {
      const linkedUser = donor.userId ? linkedUsersMap.get(donor.userId.toString()) : null;

      // Calculate age from linked user's DOB
      let age: number | null = null;
      if (linkedUser?.dateOfBirth) {
        const dob = new Date(linkedUser.dateOfBirth);
        const now = new Date();
        age = now.getFullYear() - dob.getFullYear();
        const m = now.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      }

      return {
        ...toPublicDonor(donor, origin),
        source: "admin" as const,
        photo: linkedUser?.photoUrl ?? null,
        age,
        isContactVisible: false,
        // Show phone if linked user exists (they registered themselves)
        phone: linkedUser?.phone ?? null,
      };
    });

    // 5. Merge, sort by distance if origin provided
    const merged = [...userDonorSummaries, ...adminDonorSummaries];
    if (origin) {
      merged.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    }

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const paginated = merged.slice(skip, skip + limit);

    return {
      data: paginated,
      pagination: { page, limit, total: merged.length, totalPages: Math.ceil(merged.length / limit) },
    };
  }

  async getPublicDetail(id: string) {
    const donor = await this.repository.findActiveById(id);
    if (!donor || !donor.isAvailable) throw new NotFoundError("Donor not found");
    return toPublicDonor(donor);
  }

  async createContactLink(donorId: string, requesterId: string) {
    const [donor, requester] = await Promise.all([
      this.repository.findActiveById(donorId),
      UserModel.findById(requesterId),
    ]);
    if (!donor || !donor.isAvailable) throw new NotFoundError("Donor not available");
    if (!requester) throw new NotFoundError("Requester not found");

    await this.enforceContactLimit(donorId, requesterId);
    await this.repository.incrementContactCount(donorId);

    const requesterName = firstName(`${requester.firstName ?? ""} ${requester.lastName ?? ""}`.trim() || "User");
    const message = buildDonorWhatsAppMessage(donor.bloodGroup, donor.city, requesterName);
    return {
      donor: toPublicDonor(donor),
      whatsappLink: buildWhatsAppLink(donor.phone, message),
      message,
      contactsRemainingToday: Math.max(0, DONOR_CONTACT_DAILY_LIMIT - (await this.contactCount(donorId))),
    };
  }

  async createAdminDonor(data: AdminCreateDonorInput) {
    const phone = normalizeIndianPhone(data.phone);
    if (await this.repository.findByPhone(phone)) throw new ConflictError("Phone number already exists");
    return this.repository.create({
      ...this.toUpdateData(data),
      phone,
      name: data.name,
      userId: data.userId ? new Types.ObjectId(data.userId) : null,
      bloodGroup: data.bloodGroup,
      city: data.city,
      source: "admin_imported",
      isPhoneVerified: data.isPhoneVerified,
      isVerified: data.isVerified,
      eligibilitySelfDeclared: data.eligibilitySelfDeclared,
      eligibilityDeclaredAt: data.eligibilitySelfDeclared ? new Date() : null,
      contactCount: { today: 0, thisWeek: 0, total: 0 },
      isActive: true,
    });
  }

  async updateAdminDonor(id: string, data: AdminUpdateDonorInput) {
    const update = this.toUpdateData(data);
    if (data.phone) update.phone = normalizeIndianPhone(data.phone);
    const donor = await this.repository.updateById(id, update);
    if (!donor) throw new NotFoundError("Donor not found");
    return donor;
  }

  async listAdmin(query: Record<string, any>) {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.city) filter.city = { $regex: query.city, $options: "i" };
    if (query.isVerified) filter.isVerified = query.isVerified === "true";
    if (query.isAvailable) filter.isAvailable = query.isAvailable === "true";
    if (query.q) filter.$or = [
      { name: { $regex: query.q, $options: "i" } },
      { phone: { $regex: query.q, $options: "i" } },
      { city: { $regex: query.q, $options: "i" } },
    ];
    const result = await this.repository.listAdmin(filter, query.page, query.limit);
    return { data: result.donors, pagination: pagination(query.page, query.limit, result.total) };
  }

  async getAdminDonor(id: string) {
    const donor = await this.repository.findActiveById(id);
    if (!donor) throw new NotFoundError("Donor not found");
    return donor;
  }

  async deleteAdminDonor(id: string) {
    const donor = await this.repository.softDelete(id);
    if (!donor) throw new NotFoundError("Donor not found");
  }

  async verifyAdminDonor(id: string) {
    const donor = await this.repository.updateById(id, { isVerified: true });
    if (!donor) throw new NotFoundError("Donor not found");
    return donor;
  }

  async suspendAdminDonor(id: string) {
    const donor = await this.repository.updateById(id, { isAvailable: false });
    if (!donor) throw new NotFoundError("Donor not found");
    return donor;
  }

  analytics() {
    return this.repository.analytics();
  }

  async importCsv(csvContent: string) {
    const rows = parseCsvRows(csvContent);
    const errors: Array<Record<string, unknown>> = [];
    let imported = 0;
    for (const [index, row] of rows.entries()) {
      try {
        await this.createAdminDonor({
          name: row.name,
          phone: row.phone,
          bloodGroup: row.bloodGroup as any,
          city: row.city,
          pincode: row.pincode || undefined,
          lastDonationDate: row.lastDonationDate ? new Date(row.lastDonationDate) : undefined,
          isAvailable: true,
          isPhoneVerified: false,
          isVerified: false,
          eligibilitySelfDeclared: false,
        });
        imported++;
      } catch (error: any) {
        errors.push({ row: index + 2, message: error.message, data: row });
      }
    }
    return { totalRows: rows.length, imported, failed: errors.length, errors };
  }

  private toUpdateData(data: Record<string, any>): Partial<BloodDonorDocument> {
    const update: Partial<BloodDonorDocument> = { ...data } as Partial<BloodDonorDocument>;
    if (data.city || data.pincode) update.location = geocodeIndianLocation(data.city, data.pincode);
    if (data.lastDonationDate) update.lastDonationDate = new Date(data.lastDonationDate);
    if (data.eligibilitySelfDeclared) update.eligibilityDeclaredAt = new Date();
    return update;
  }

  private async enforceContactLimit(donorId: string, requesterId: string) {
    const key = DONOR_CONTACT_RATE_KEY(donorId, new Date().toISOString().slice(0, 10));
    if (this.redis) {
      await this.redis.sadd(key, requesterId);
      await this.redis.expire(key, 24 * 60 * 60);
      const count = await this.redis.scard(key);
      if (count > DONOR_CONTACT_DAILY_LIMIT) throw new RateLimitError("This donor has reached today's contact limit");
      return;
    }
    const set = memoryContactSets.get(key) ?? new Set<string>();
    set.add(requesterId);
    memoryContactSets.set(key, set);
    if (set.size > DONOR_CONTACT_DAILY_LIMIT) throw new RateLimitError("This donor has reached today's contact limit");
  }

  private async contactCount(donorId: string) {
    const key = DONOR_CONTACT_RATE_KEY(donorId, new Date().toISOString().slice(0, 10));
    if (this.redis) return this.redis.scard(key);
    return memoryContactSets.get(key)?.size ?? 0;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAge(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age--;
  return age;
}

function pagination(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
