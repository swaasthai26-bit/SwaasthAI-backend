import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { startTestInfra, stopTestInfra } from "./setup";
import { BookingIntentModel } from "../src/modules/booking_intents/booking_intent.model";
import { DoctorModel } from "../src/modules/doctors/doctor.schema";
import { HospitalModel } from "../src/modules/hospitals/hospital.schema";
import { UserModel } from "../src/modules/users/user.schema";
import { issueTokens } from "../src/modules/auth/jwt";
import { getRedisClient } from "../src/db/redis";

const app = createApp();

beforeAll(async () => {
  await startTestInfra();
});

afterAll(async () => {
  await stopTestInfra();
});

beforeEach(async () => {
  await Promise.all([
    BookingIntentModel.deleteMany({}),
    DoctorModel.deleteMany({}),
    HospitalModel.deleteMany({}),
    UserModel.deleteMany({}),
  ]);
  await getRedisClient()?.flushall();
});

function timings(isClosed = false) {
  const day = { open: "00:00", close: "23:59", isClosed };
  return {
    mon: day,
    tue: day,
    wed: day,
    thu: day,
    fri: day,
    sat: day,
    sun: day,
  };
}

async function authUser(
  role: "user" | "content_admin" | "platform_admin" = "user",
) {
  const user = await UserModel.create({
    phone: `+91987654${Math.floor(1000 + Math.random() * 8999)}`,
    role,
    isPhoneVerified: true,
    firstName: role === "user" ? "Rahul" : "Admin",
    lastName: "Sharma",
    dateOfBirth: new Date("1995-04-12"),
    gender: "male",
  });
  const tokens = await issueTokens(user.id, role, "test-device");
  return { user, token: tokens.accessToken };
}

async function hospital(overrides: Record<string, unknown> = {}) {
  return HospitalModel.create({
    name: "City Hospital",
    slug: `city-hospital-${new Types.ObjectId().toString()}`,
    description: "Multi-specialty hospital",
    location: { type: "Point", coordinates: [85.1376, 25.5941] },
    address: "Main Road, Patna",
    city: "Patna",
    state: "Bihar",
    pincode: "800001",
    country: "India",
    whatsappNumber: "+919999999999",
    contactPhone: "+918888888888",
    contactEmail: "hello@cityhospital.example",
    specializations: ["cardiology"],
    amenities: ["parking"],
    photos: [],
    timings: timings(),
    holidays: [],
    acceptedInsurancePlans: [],
    startingConsultationFee: 500,
    status: "active",
    isVerified: true,
    ...overrides,
  });
}

async function doctor(hospitalId: string) {
  return DoctorModel.create({
    name: "Dr. Sharma",
    qualification: "MBBS, MD",
    primarySpecialization: "cardiology",
    registrationNumber: new Types.ObjectId().toString(),
    hospitalAffiliations: [
      { hospitalId, consultationFee: 700, isPrimary: true },
    ],
    availability: [
      { hospitalId, dayOfWeek: "Monday", startTime: "10:00", endTime: "14:00" },
    ],
    isActive: true,
  });
}

describe("booking intents", () => {
  it("creates a WhatsApp booking intent with a deep link", async () => {
    const [{ token }, h] = await Promise.all([authUser(), hospital()]);
    const d = await doctor(h.id);

    const res = await request(app)
      .post("/api/v1/booking-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ hospitalId: h.id, doctorId: d.id, source: "doctor_profile" });

    expect(res.status).toBe(200);
    expect(res.body.data.contactMethod).toBe("whatsapp");
    expect(res.body.data.whatsappLink).toContain(
      "https://wa.me/919999999999?text=",
    );
    expect(decodeURIComponent(res.body.data.whatsappLink)).toContain(
      "Dr. Sharma",
    );
    expect(res.body.data.callLink).toBeNull();
  });

  it("returns the user's inquiry history and can reopen a previous intent", async () => {
    const [{ token }, h] = await Promise.all([authUser(), hospital()]);

    const created = await request(app)
      .post("/api/v1/booking-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ hospitalId: h.id, source: "hospital_profile" });

    const mine = await request(app)
      .get("/api/v1/booking-intents/my")
      .set("Authorization", `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.data).toHaveLength(1);
    expect(mine.body.data.data[0].hospital.name).toBe("City Hospital");

    const reopen = await request(app)
      .get(`/api/v1/booking-intents/${created.body.data.intentId}/reopen`)
      .set("Authorization", `Bearer ${token}`);
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.whatsappLink).toContain("https://wa.me/");
  });

  it("falls back to a call action when no WhatsApp number is present", async () => {
    const [{ token }, h] = await Promise.all([
      authUser(),
      hospital({ whatsappNumber: null }),
    ]);

    const res = await request(app)
      .post("/api/v1/booking-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ hospitalId: h.id, source: "hospital_profile" });

    expect(res.status).toBe(200);
    expect(res.body.data.contactMethod).toBe("call");
    expect(res.body.data.callLink).toBe("tel:+918888888888");
    expect(res.body.data.whatsappLink).toBeNull();
  });

  it("limits users to 10 booking intents per hospital per hour", async () => {
    const [{ token }, h] = await Promise.all([authUser(), hospital()]);

    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/v1/booking-intents")
        .set("Authorization", `Bearer ${token}`)
        .send({ hospitalId: h.id, source: "hospital_profile" });
      expect(res.status).toBe(200);
    }

    const limited = await request(app)
      .post("/api/v1/booking-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ hospitalId: h.id, source: "hospital_profile" });
    expect(limited.status).toBe(500);
  });

  it("allows admins to list intents and view analytics", async () => {
    const [{ token }, { token: adminToken }, h] = await Promise.all([
      authUser(),
      authUser("content_admin"),
      hospital(),
    ]);

    await request(app)
      .post("/api/v1/booking-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ hospitalId: h.id, source: "hospital_profile" });

    const list = await request(app)
      .get("/api/v1/admin/booking-intents")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.data).toHaveLength(1);

    const analytics = await request(app)
      .get("/api/v1/admin/booking-intents/analytics")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data.total).toBe(1);
    expect(analytics.body.data.topHospitals[0].name).toBe("City Hospital");
  });
});
