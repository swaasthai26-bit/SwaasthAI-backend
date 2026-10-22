import { getRedisClient } from "../../db/redis";
import { ConflictError, NotFoundError, RateLimitError } from "../../shared/errors";
import { DoctorModel } from "../doctors/doctor.schema";
import { HospitalModel } from "../hospitals/hospital.schema";
import { UserModel } from "../users/user.schema";
import { BookingIntentModel } from "./booking_intent.model";

const BOOKING_LIMIT_PER_HOUR = 10;
const BOOKING_RATE_WINDOW_SECONDS = 60 * 60;

type BookingSource = "hospital_profile" | "doctor_profile" | "search_result";
type ContactMethod = "whatsapp" | "call";

interface CreateBookingIntentInput {
  userId: string;
  hospitalId: string;
  doctorId?: string;
  source: BookingSource;
}

interface ListQuery {
  page: number;
  limit: number;
  userId?: string;
  hospitalId?: string;
  doctorId?: string;
  /** ISO date string — only return intents created on or after this date */
  from?: string;
  /** ISO date string — only return intents created on or before this date */
  to?: string;
  /** Free-text search matched against user phone / firstName / lastName */
  q?: string;
}

export class BookingIntentService {
  async create(input: CreateBookingIntentInput) {
    const [hospital, doctor, user] = await Promise.all([
      HospitalModel.findOne({ _id: input.hospitalId, deletedAt: null }),
      input.doctorId ? DoctorModel.findOne({ _id: input.doctorId, deletedAt: null }) : null,
      UserModel.findById(input.userId),
    ]);

    if (!hospital) throw new NotFoundError("Hospital not found");
    if (input.doctorId && !doctor) throw new NotFoundError("Doctor not found");
    if (!user) throw new NotFoundError("User not found");
    if (hospital.status !== "active" || !hospital.isVerified) {
      throw new ConflictError("Hospital is not available for booking", "HOSPITAL_UNAVAILABLE");
    }
    if (this.isClosedToday(hospital)) {
      throw new ConflictError("Hospital is closed today. Please try another day.", "HOSPITAL_CLOSED_TODAY");
    }
    if (doctor && !this.doctorBelongsToHospital(doctor, input.hospitalId)) {
      throw new ConflictError("Doctor is not affiliated with this hospital", "DOCTOR_HOSPITAL_MISMATCH");
    }

    await this.enforceRateLimit(input.userId, input.hospitalId);

    const requesterName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User";
    const doctorText = doctor
      ? ` with ${doctor.name} (${doctor.primarySpecialization})`
      : "";
    const message = `Hi, I would like to book an appointment${doctorText} at ${hospital.name}. My name is ${requesterName}. Please let me know the available times. - Sent via SwaasthAI app`;
    const contact = this.buildContact(hospital.whatsappNumber, hospital.contactPhone, message);

    const intent = await BookingIntentModel.create({
      userId: input.userId,
      hospitalId: hospital._id.toString(),
      doctorId: doctor?._id.toString() ?? null,
      whatsappNumberUsed: contact.value,
      contactMethod: contact.method,
      contactValue: contact.value,
      messageTemplate: message,
      source: input.source,
    });

    return {
      data: {
        intentId: intent._id,
        contactMethod: contact.method,
        actionLink: contact.actionLink,
        whatsappLink: contact.method === "whatsapp" ? contact.actionLink : null,
        callLink: contact.method === "call" ? contact.actionLink : null,
        message,
        hospital: this.hospitalSummary(hospital),
        doctor: doctor ? this.doctorSummary(doctor) : null,
      },
    };
  }

  async listMine(userId: string, query: Omit<ListQuery, "userId" | "q">) {
    return this.list({ ...query, userId });
  }

  async getMine(intentId: string, userId: string) {
    const intent: any = await BookingIntentModel.findOne({ _id: intentId, userId }).lean();
    if (!intent) throw new NotFoundError("Booking intent not found");

    const [hospital, doctor] = await Promise.all([
      intent.hospitalId
        ? HospitalModel.findById(intent.hospitalId).select("name city contactPhone whatsappNumber").lean()
        : null,
      intent.doctorId
        ? DoctorModel.findById(intent.doctorId).select("name primarySpecialization").lean()
        : null,
    ]);

    const user: any = await UserModel.findById(intent.userId).select("phone firstName lastName").lean();

    return {
      data: this.intentResponse(
        intent,
        new Map(hospital ? [[(hospital as any)._id.toString(), hospital]] : []),
        new Map(doctor ? [[(doctor as any)._id.toString(), doctor]] : []),
        new Map(user ? [[intent.userId, user]] : []),
      ),
    };
  }

  async list(query: ListQuery) {
    // ── User search: resolve matching userIds first ──────────────────────────
    let resolvedUserIds: string[] | null = null;
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchedUsers = await UserModel.find({
        $or: [{ phone: regex }, { firstName: regex }, { lastName: regex }],
      })
        .select("_id")
        .lean();
      resolvedUserIds = matchedUsers.map((u: any) => u._id.toString());
    }

    // ── Build filter ─────────────────────────────────────────────────────────
    const filter: Record<string, unknown> = {};

    if (query.userId) {
      filter.userId = query.userId;
    } else if (resolvedUserIds !== null) {
      // If q was supplied but matched no users → force empty result
      filter.userId = { $in: resolvedUserIds };
    }

    if (query.hospitalId) filter.hospitalId = query.hospitalId;
    if (query.doctorId) filter.doctorId = query.doctorId;

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.$gte = new Date(query.from);
      if (query.to) {
        // Include the full "to" day by moving to the end of that day
        const toDate = new Date(query.to);
        toDate.setUTCHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }
      filter.createdAt = dateFilter;
    }

    // ── Query ────────────────────────────────────────────────────────────────
    const skip = (query.page - 1) * query.limit;
    const [intents, total] = await Promise.all([
      BookingIntentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      BookingIntentModel.countDocuments(filter),
    ]);

    // ── Hydrate hospitals, doctors, users ────────────────────────────────────
    const hospitalIds = [...new Set(intents.map((i) => i.hospitalId).filter(Boolean))];
    const doctorIds   = [...new Set(intents.map((i) => i.doctorId).filter(Boolean))];
    const userIds     = [...new Set(intents.map((i) => i.userId).filter(Boolean))];

    const [hospitals, doctors, users] = await Promise.all([
      HospitalModel.find({ _id: { $in: hospitalIds } }).select("name city contactPhone whatsappNumber").lean(),
      DoctorModel.find({ _id: { $in: doctorIds } }).select("name primarySpecialization").lean(),
      UserModel.find({ _id: { $in: userIds } }).select("phone firstName lastName").lean(),
    ]);

    const hospitalById = new Map(hospitals.map((h: any) => [h._id.toString(), h]));
    const doctorById   = new Map(doctors.map((d: any)   => [d._id.toString(), d]));
    const userById     = new Map(users.map((u: any)     => [u._id.toString(), u]));

    return {
      data: intents.map((intent: any) =>
        this.intentResponse(intent, hospitalById, doctorById, userById),
      ),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Export all matching intents as a CSV string (admin only). */
  async exportCsv(query: Omit<ListQuery, "page" | "limit">) {
    // Reuse list() with a high enough limit to get all matching records.
    // For very large datasets this is acceptable for admin exports.
    const result = await this.list({ ...query, page: 1, limit: 10_000 });
    const rows = result.data;

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = [
      "intentId",
      "createdAt",
      "userId",
      "userPhone",
      "userName",
      "hospitalId",
      "hospitalName",
      "hospitalCity",
      "doctorId",
      "doctorName",
      "doctorSpecialization",
      "source",
      "contactMethod",
      "actionLink",
    ];

    const lines = [
      headers.join(","),
      ...rows.map((r: any) =>
        [
          r.id,
          r.createdAt ? new Date(r.createdAt).toISOString() : "",
          r.userId,
          r.user?.phone ?? "",
          r.user?.name ?? "",
          r.hospitalId,
          r.hospital?.name ?? "",
          r.hospital?.city ?? "",
          r.doctorId ?? "",
          r.doctor?.name ?? "",
          r.doctor?.primarySpecialization ?? "",
          r.source,
          r.contactMethod,
          r.actionLink,
        ]
          .map(escape)
          .join(","),
      ),
    ];

    return lines.join("\r\n");
  }

  async reopen(intentId: string, userId: string) {
    const intent: any = await BookingIntentModel.findOne({ _id: intentId, userId }).lean();
    if (!intent) throw new NotFoundError("Booking intent not found");
    return {
      data: {
        intentId: intent._id,
        contactMethod: intent.contactMethod ?? "whatsapp",
        actionLink: this.reopenLink(intent),
        whatsappLink: (intent.contactMethod ?? "whatsapp") === "whatsapp" ? this.reopenLink(intent) : null,
        callLink: intent.contactMethod === "call" ? this.reopenLink(intent) : null,
        message: intent.messageTemplate,
      },
    };
  }

  async analytics() {
    const [total, byHospital, byDoctor, byDay, bySource] = await Promise.all([
      BookingIntentModel.countDocuments(),
      BookingIntentModel.aggregate([
        { $group: { _id: "$hospitalId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      BookingIntentModel.aggregate([
        { $match: { doctorId: { $ne: null } } },
        { $group: { _id: "$doctorId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      BookingIntentModel.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),
      BookingIntentModel.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      data: {
        total,
        topHospitals: await this.hydrateAnalytics(byHospital, "hospital"),
        topDoctors: await this.hydrateAnalytics(byDoctor, "doctor"),
        byDay: byDay.map((row) => ({ date: row._id, count: row.count })),
        bySource: bySource.map((row) => ({ source: row._id, count: row.count })),
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async enforceRateLimit(userId: string, hospitalId: string) {
    const redis = getRedisClient();
    if (redis) {
      const key = `booking:intent:rate:${userId}:${hospitalId}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, BOOKING_RATE_WINDOW_SECONDS);
      if (count > BOOKING_LIMIT_PER_HOUR) {
        throw new RateLimitError("You have reached the booking request limit for this hospital", {
          retryAfterSeconds: await redis.ttl(key),
        });
      }
      return;
    }

    const since = new Date(Date.now() - BOOKING_RATE_WINDOW_SECONDS * 1000);
    const count = await BookingIntentModel.countDocuments({
      userId,
      hospitalId,
      createdAt: { $gte: since },
    });
    if (count >= BOOKING_LIMIT_PER_HOUR) {
      throw new RateLimitError("You have reached the booking request limit for this hospital", {
        retryAfterSeconds: BOOKING_RATE_WINDOW_SECONDS,
      });
    }
  }

  private buildContact(whatsappNumber: string | null | undefined, contactPhone: string, message: string) {
    if (whatsappNumber) {
      return {
        method: "whatsapp" as ContactMethod,
        value: whatsappNumber,
        actionLink: `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      };
    }
    return {
      method: "call" as ContactMethod,
      value: contactPhone,
      actionLink: `tel:${contactPhone}`,
    };
  }

  private reopenLink(intent: any) {
    const method = intent.contactMethod ?? "whatsapp";
    const value = intent.contactValue ?? intent.whatsappNumberUsed;
    if (method === "call") return `tel:${value}`;
    return `https://wa.me/${value.replace(/\D/g, "")}?text=${encodeURIComponent(intent.messageTemplate)}`;
  }

  private isClosedToday(hospital: any) {
    const now = new Date();
    const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = istNow.toISOString().slice(0, 10);
    const hasHoliday = (hospital.holidays ?? []).some((holiday: Date) => {
      const istHoliday = new Date(new Date(holiday).getTime() + 5.5 * 60 * 60 * 1000);
      return istHoliday.toISOString().slice(0, 10) === dateKey;
    });
    if (hasHoliday) return true;

    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const today = hospital.timings?.[dayKeys[istNow.getUTCDay()]];
    return !today || today.isClosed;
  }

  private doctorBelongsToHospital(doctor: any, hospitalId: string) {
    return (doctor.hospitalAffiliations ?? []).some(
      (affiliation: any) => affiliation.hospitalId?.toString() === hospitalId,
    );
  }

  private intentResponse(
    intent: any,
    hospitalById: Map<string, any>,
    doctorById: Map<string, any>,
    userById: Map<string, any> = new Map(),
  ) {
    const hospital = hospitalById.get(intent.hospitalId);
    const doctor   = intent.doctorId ? doctorById.get(intent.doctorId) : null;
    const user     = userById.get(intent.userId);
    const actionLink = this.reopenLink(intent);

    return {
      id: intent._id.toString(),
      userId: intent.userId,
      user: user
        ? {
            phone: user.phone,
            name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || null,
          }
        : null,
      hospitalId: intent.hospitalId,
      doctorId: intent.doctorId,
      source: intent.source,
      contactMethod: intent.contactMethod ?? "whatsapp",
      actionLink,
      whatsappLink: (intent.contactMethod ?? "whatsapp") === "whatsapp" ? actionLink : null,
      callLink: intent.contactMethod === "call" ? actionLink : null,
      message: intent.messageTemplate,
      hospital: hospital ? this.hospitalSummary(hospital) : null,
      doctor: doctor ? this.doctorSummary(doctor) : null,
      createdAt: intent.createdAt,
    };
  }

  private hospitalSummary(hospital: any) {
    return {
      id: hospital._id?.toString(),
      name: hospital.name,
      city: hospital.city,
      contactPhone: hospital.contactPhone,
      hasWhatsApp: Boolean(hospital.whatsappNumber),
    };
  }

  private doctorSummary(doctor: any) {
    return {
      id: doctor._id?.toString(),
      name: doctor.name,
      primarySpecialization: doctor.primarySpecialization,
    };
  }

  private async hydrateAnalytics(rows: Array<{ _id: string; count: number }>, type: "hospital" | "doctor") {
    const ids = rows.map((row) => row._id);
    const docs =
      type === "hospital"
        ? await HospitalModel.find({ _id: { $in: ids } }).select("name city").lean()
        : await DoctorModel.find({ _id: { $in: ids } }).select("name primarySpecialization").lean();
    const byId = new Map(docs.map((doc: any) => [doc._id.toString(), doc]));
    return rows.map((row) => ({
      id: row._id,
      count: row.count,
      name: byId.get(row._id)?.name ?? null,
      city: byId.get(row._id)?.city,
      primarySpecialization: byId.get(row._id)?.primarySpecialization,
    }));
  }
}

export const bookingIntentService = new BookingIntentService();
