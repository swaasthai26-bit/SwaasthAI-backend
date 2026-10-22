/* eslint-disable no-console */
// End-to-end smoke walk of the onboarding flow shown in the UI screens.
// Run with: npx ts-node tests/smoke.ts
import request from "supertest";
import { createApp } from "../src/app";
import { getRedisClient } from "../src/db/redis";
import { startTestInfra, stopTestInfra, resetTestState } from "./setup";

const PHONE = "+919876543210";

const banner = (title: string) => {
  const bar = "=".repeat(72);
  console.log(`\n${bar}\n${title}\n${bar}`);
};

const dump = (label: string, status: number, body: unknown) => {
  console.log(`[${status}] ${label}`);
  console.log(JSON.stringify(body, null, 2));
};

async function main() {
  await startTestInfra();
  await resetTestState();
  const app = createApp();

  // ──────────────────────────────────────────────────────────────────────
  banner("SCREEN 1 — Mobile Number Entry");
  // ──────────────────────────────────────────────────────────────────────

  // Mock 1: 4-digit phone → UI shows "Phone number must be 10 digits"
  let res = await request(app).post("/api/v1/auth/otp/send").send({ phone: "9999" });
  dump("send-otp with too-short phone", res.status, res.body);

  // Mock 2: phone without +91 prefix
  res = await request(app).post("/api/v1/auth/otp/send").send({ phone: "9876543210" });
  dump("send-otp without country code", res.status, res.body);

  // Mock 3: valid 10-digit Indian phone
  res = await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
  dump("send-otp with valid phone", res.status, res.body);
  const firstCode: string = res.body.devOtp;

  // Mock 4: tap "Resend" immediately → cooldown
  res = await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
  dump("send-otp again immediately (cooldown)", res.status, res.body);

  // ──────────────────────────────────────────────────────────────────────
  banner("SCREEN 2 — OTP Verification");
  // ──────────────────────────────────────────────────────────────────────

  // Mock 5: wrong OTP — UI shows "Incorrect code, 2 attempts remaining"
  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: "000000" });
  dump("verify-otp wrong (attempt 1)", res.status, res.body);

  // Mock 6: second wrong attempt
  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: "111111" });
  dump("verify-otp wrong (attempt 2)", res.status, res.body);

  // Mock 7: third wrong → lock for 30s
  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: "222222" });
  dump("verify-otp wrong (attempt 3 → 30s lockout)", res.status, res.body);

  // Mock 8: try while locked
  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: "333333" });
  dump("verify-otp while locked", res.status, res.body);

  // Clear lockout + cooldown so we can simulate "user waits and tries again"
  const r = getRedisClient()!;
  await r.del(`otp:lockout:${PHONE}`);
  await r.del(`otp:resend:${PHONE}`);
  await r.del(`otp:lockcount:${PHONE}`);
  await r.del(`otp:rate:${PHONE}`);

  // Mock 9: request a fresh OTP and verify successfully
  res = await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
  dump("send-otp (fresh after wait)", res.status, res.body);
  const freshCode: string = res.body.devOtp;

  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({
      phone: PHONE,
      otp: freshCode,
    });
  dump("verify-otp correct → JWTs issued, isNewUser=true", res.status, res.body);
  const accessToken: string = res.body.accessToken;
  const refreshToken: string = res.body.refreshToken;

  // ──────────────────────────────────────────────────────────────────────
  banner("SCREEN 3 — Name / DOB / Gender (PUT /me)");
  // ──────────────────────────────────────────────────────────────────────

  // Mock 10: hit /me without auth
  res = await request(app).get("/api/v1/me");
  dump("GET /me without auth", res.status, res.body);

  // Mock 11: GET /me with token → unregistered profile
  res = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`);
  dump("GET /me with token (isRegistered=false expected)", res.status, res.body);

  // Mock 12: PUT /me — UI screen "What's your name?" with empty first name
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ firstName: "", lastName: "Sharma" });
  dump("PUT /me empty firstName", res.status, res.body);

  // Mock 13: DOB in the future
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ firstName: "Rahul", lastName: "Sharma", dateOfBirth: "2099-01-01", gender: "male" });
  dump("PUT /me future DOB", res.status, res.body);

  // Mock 14: DOB under 13 (FR-1.1)
  const today = new Date();
  const twelveYearsAgo = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate())
    .toISOString()
    .slice(0, 10);
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      firstName: "Rahul",
      lastName: "Sharma",
      dateOfBirth: twelveYearsAgo,
      gender: "male",
    });
  dump("PUT /me DOB makes user 12yo", res.status, res.body);

  // Mock 15: invalid gender
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ gender: "unicorn" });
  dump("PUT /me invalid gender enum", res.status, res.body);

  // Mock 16: valid registration data
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      firstName: "Rahul",
      lastName: "Sharma",
      dateOfBirth: "1995-04-12",
      gender: "male",
    });
  dump("PUT /me valid registration → isRegistered=true", res.status, res.body);

  // ──────────────────────────────────────────────────────────────────────
  banner("BONUS — Token rotation + reuse detection");
  // ──────────────────────────────────────────────────────────────────────

  // Mock 17: rotate refresh token
  res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
  dump("refresh token (rotation)", res.status, res.body);
  const rotated: string = res.body.refreshToken;

  // Mock 18: reuse OLD refresh → must trigger family revocation
  res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
  dump("refresh OLD token reuse → all sessions revoked", res.status, res.body);

  // Mock 19: the rotated token is also dead now
  res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: rotated });
  dump("rotated token after revocation cascade", res.status, res.body);

  // ──────────────────────────────────────────────────────────────────────
  banner("DONE");
  await stopTestInfra();
}

main().catch((err) => {
  console.error("Smoke run failed:", err);
  process.exit(1);
});
