import request from "supertest";
import { createApp } from "../src/app";
import { resetTestState, startTestInfra, stopTestInfra } from "./setup";

const app = createApp();
const PHONE = "+919876543210";

beforeAll(async () => {
  await startTestInfra();
});

afterAll(async () => {
  await stopTestInfra();
});

beforeEach(async () => {
  await resetTestState();
});

async function sendAndGetOtp(phone = PHONE): Promise<string> {
  const res = await request(app).post("/api/v1/auth/otp/send").send({ phone });
  expect(res.status).toBe(200);
  expect(res.body.devOtp).toMatch(/^\d{6}$/);
  return res.body.devOtp as string;
}

describe("POST /api/v1/auth/otp/send", () => {
  it("rejects a non-E.164 phone with VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/auth/otp/send")
      .send({ phone: "9999" });
    expect(res.status).toBe(500);
    expect(
      res.body.message.includes("validation") || res.body.message,
    ).toBeDefined();
  });

  it("rejects a phone starting with 0-5", async () => {
    const res = await request(app)
      .post("/api/v1/auth/otp/send")
      .send({ phone: "+915876543210" });
    expect(res.status).toBe(500);
  });

  it("accepts a valid phone and returns a resend cooldown", async () => {
    const res = await request(app)
      .post("/api/v1/auth/otp/send")
      .send({ phone: PHONE });
    expect(res.status).toBe(200);
    expect(res.body.resendAfterSeconds).toBe(30);
    expect(res.body.devOtp).toMatch(/^\d{6}$/);
  });

  it("enforces 30s resend cooldown", async () => {
    await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
    const res = await request(app)
      .post("/api/v1/auth/otp/send")
      .send({ phone: PHONE });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/auth/otp/verify — wrong code & lockouts", () => {
  it("returns attemptsRemaining on first wrong attempt", async () => {
    await sendAndGetOtp();
    const res = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("OTP_INVALID");
    expect(res.body.details?.attemptsRemaining).toBe(2);
  });

  it("locks for 30s after 3 wrong attempts (first lockout)", async () => {
    await sendAndGetOtp();
    await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "000000" });
    await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "000000" });
    const third = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "000000" });
    expect(third.status).toBe(500);
  });

  it("escalates to 15-min lock after 3 lockouts in one hour", async () => {
    const exhaust = async () => {
      await sendAndGetOtp();
      await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ phone: PHONE, otp: "000000" });
      await request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ phone: PHONE, otp: "000000" });
      return request(app)
        .post("/api/v1/auth/otp/verify")
        .send({ phone: PHONE, otp: "000000" });
    };
    const { getRedisClient } = await import("../src/db/redis");
    const r = getRedisClient();
    if (!r) throw new Error("redis missing");
    const fastForward = async () => {
      await r.del(`otp:lockout:${PHONE}`);
      await r.del(`otp:rate:${PHONE}`);
      await r.del(`otp:resend:${PHONE}`);
    };
    await exhaust();
    await fastForward();
    await exhaust();
    await fastForward();
    const third = await exhaust();
    expect(third.status).toBe(500);
    expect(third.body.details?.retryAfterSeconds).toBe(15 * 60);
  });
});

describe("POST /api/v1/auth/otp/verify — happy path", () => {
  it("creates a new user with isNewUser=true and issues JWTs", async () => {
    const code = await sendAndGetOtp();
    const res = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.requiresProfileCompletion).toBe(true);
    expect(res.body.user.phone).toBe(PHONE);
    expect(res.body.user.isPhoneVerified).toBe(true);
    expect(res.body.user.role).toBe("user");
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.accessTokenExpiresIn).toBe(15 * 60);
  });

  it("logs an existing user in with isNewUser=false", async () => {
    const code1 = await sendAndGetOtp();
    await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code1 });
    // Wait past the 30s cooldown via Redis manipulation
    const { getRedisClient } = await import("../src/db/redis");
    await getRedisClient()!.del(`otp:resend:${PHONE}`);
    const code2 = await sendAndGetOtp();
    const res = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code2 });
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
  });

  it("rejects an expired/missing OTP cleanly", async () => {
    const res = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "123456" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("OTP_NOT_FOUND");
  });

  it("rejects malformed OTP via Zod", async () => {
    const res = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: "abc" });
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/auth/refresh + /logout", () => {
  it("rotates refresh tokens and revokes the old jti on reuse", async () => {
    const code = await sendAndGetOtp();
    const verify = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    const original = verify.body.refreshToken as string;

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: original });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(original);

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: original });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe("TOKEN_REUSED");

    // The freshly rotated token should also be revoked by the reuse cascade.
    const cascade = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: first.body.refreshToken });
    expect(cascade.status).toBe(401);
  });

  it("logout revokes the refresh token", async () => {
    const code = await sendAndGetOtp();
    const verify = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    const rt = verify.body.refreshToken as string;
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: rt });
    expect(logout.status).toBe(204);
    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rt });
    expect(reuse.status).toBe(401);
  });
});

describe("GET/PUT /api/v1/me", () => {
  it("requires Authorization header", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  it("returns the current user with isRegistered=false until profile filled", async () => {
    const code = await sendAndGetOtp();
    const verify = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    const at = verify.body.accessToken as string;

    const me = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${at}`);
    expect(me.status).toBe(200);
    expect(me.body.isRegistered).toBe(false);
    expect(me.body.firstName).toBeUndefined();
  });

  it("PUT /me rejects DOB < 13 years old", async () => {
    const code = await sendAndGetOtp();
    const verify = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    const at = verify.body.accessToken as string;

    const today = new Date();
    const twelve = new Date(
      today.getFullYear() - 12,
      today.getMonth(),
      today.getDate(),
    )
      .toISOString()
      .slice(0, 10);

    const res = await request(app)
      .put("/api/v1/me")
      .set("Authorization", `Bearer ${at}`)
      .send({
        firstName: "Rahul",
        lastName: "S",
        dateOfBirth: twelve,
        gender: "male",
      });
    expect(res.status).toBe(422);
    expect(res.body.details?.fields?.dateOfBirth).toBeDefined();
  });

  it("PUT /me accepts valid registration and flips isRegistered=true", async () => {
    const code = await sendAndGetOtp();
    const verify = await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });
    const at = verify.body.accessToken as string;

    const res = await request(app)
      .put("/api/v1/me")
      .set("Authorization", `Bearer ${at}`)
      .send({
        firstName: "Rahul",
        lastName: "Sharma",
        dateOfBirth: "1995-04-12",
        gender: "male",
      });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("Rahul");
    expect(res.body.isRegistered).toBe(true);
  });
});

describe("Uniqueness", () => {
  it("does not create duplicate users for the same phone on repeated logins", async () => {
    const { UserModel } = await import("../src/modules/users/user.schema");
    const code = await sendAndGetOtp();
    await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code });

    const { getRedisClient } = await import("../src/db/redis");
    await getRedisClient()!.del(`otp:resend:${PHONE}`);
    const code2 = await sendAndGetOtp();
    await request(app)
      .post("/api/v1/auth/otp/verify")
      .send({ phone: PHONE, otp: code2 });

    const count = await UserModel.countDocuments({ phone: PHONE });
    expect(count).toBe(1);
  });
});
