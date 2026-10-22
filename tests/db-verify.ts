/* eslint-disable no-console */
// Direct MongoDB verification: shows the actual document at each step,
// proving that storage + retrieval + indexes + soft-delete all work.
// Run with: npx ts-node tests/db-verify.ts
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../src/app";
import { getRedisClient } from "../src/db/redis";
import { UserModel } from "../src/modules/users/user.schema";
import { findUserByPhone, softDeleteUser } from "../src/modules/users/user.repository";
import { startTestInfra, stopTestInfra, resetTestState } from "./setup";

const PHONE = "+919876543210";

const banner = (title: string) => {
  console.log(`\n${"─".repeat(70)}\n  ${title}\n${"─".repeat(70)}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const fail = (msg: string) => {
  console.log(`  ✗ ${msg}`);
  process.exitCode = 1;
};

async function main() {
  await startTestInfra();
  await resetTestState();
  const app = createApp();

  // ── 1 ── Cold start: collection is empty
  banner("STEP 1  Cold start — users collection should be empty");
  const initialCount = await UserModel.countDocuments({});
  console.log(`  countDocuments({}) = ${initialCount}`);
  initialCount === 0 ? ok("empty as expected") : fail("collection not empty");

  // ── 2 ── Confirm indexes on the collection
  banner("STEP 2  Mongo indexes on `users` collection");
  const indexes = await UserModel.collection.indexes();
  console.log(JSON.stringify(indexes, null, 2));
  const hasUniquePhone = indexes.some(
    (i) =>
      i.name === "uniq_phone_active" &&
      i.unique === true &&
      JSON.stringify(i.partialFilterExpression) === JSON.stringify({ deletedAt: null }),
  );
  hasUniquePhone
    ? ok("unique sparse phone index present with partialFilterExpression { deletedAt: null }")
    : fail("unique sparse phone index missing or misconfigured");

  // ── 3 ── Register via OTP flow, then query Mongo DIRECTLY
  banner("STEP 3  Register via /auth/otp + read raw document from Mongo");
  let res = await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
  const code = res.body.devOtp;
  console.log(`  sent OTP = ${code}`);

  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: code });
  const accessToken = res.body.accessToken as string;
  const apiUserId = res.body.user.id as string;
  console.log(`  API said user.id = ${apiUserId}`);

  // Read raw document — bypass any service / repository layer
  const raw = await UserModel.collection.findOne({ phone: PHONE });
  console.log("  Raw Mongo document:");
  console.log(JSON.stringify(raw, null, 2));

  raw ? ok("document exists in Mongo") : fail("user not persisted");
  raw?._id?.toString() === apiUserId
    ? ok("API-returned id matches Mongo _id")
    : fail(`id mismatch: API=${apiUserId} Mongo=${raw?._id}`);
  raw?.phone === PHONE ? ok("phone stored correctly") : fail("phone wrong in DB");
  raw?.role === "user" ? ok("role defaulted to 'user'") : fail(`role=${raw?.role}`);
  raw?.isPhoneVerified === true
    ? ok("isPhoneVerified = true after OTP verify")
    : fail("isPhoneVerified should be true");
  raw?.isActive === true ? ok("isActive = true") : fail("isActive should default true");
  raw?.deletedAt === null ? ok("deletedAt = null") : fail(`deletedAt=${raw?.deletedAt}`);
  raw?.createdAt instanceof Date ? ok("createdAt is a Date") : fail("createdAt missing/wrong");
  raw?.updatedAt instanceof Date ? ok("updatedAt is a Date") : fail("updatedAt missing/wrong");
  raw?.firstName === undefined && raw?.dateOfBirth === undefined
    ? ok("profile fields not yet set (matches isRegistered=false)")
    : fail("profile fields prematurely set");

  // ── 4 ── PUT /me, then re-read raw doc
  banner("STEP 4  PUT /me — verify update lands in Mongo");
  res = await request(app)
    .put("/api/v1/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      firstName: "Rahul",
      lastName: "Sharma",
      dateOfBirth: "1995-04-12",
      gender: "male",
    });
  console.log(`  API response status: ${res.status}`);

  const after = await UserModel.collection.findOne({ phone: PHONE });
  console.log("  Raw Mongo document after PUT /me:");
  console.log(JSON.stringify(after, null, 2));

  after?.firstName === "Rahul" ? ok("firstName persisted") : fail("firstName not stored");
  after?.lastName === "Sharma" ? ok("lastName persisted") : fail("lastName not stored");
  after?.gender === "male" ? ok("gender persisted") : fail("gender not stored");
  after?.dateOfBirth instanceof Date
    ? ok(`dateOfBirth persisted as Date (${(after.dateOfBirth as Date).toISOString()})`)
    : fail("dateOfBirth not a Date");
  after && after.updatedAt > (raw?.updatedAt as Date)
    ? ok("updatedAt advanced after write")
    : fail("updatedAt did not advance");
  // createdAt MUST remain the same
  after?.createdAt?.getTime() === raw?.createdAt?.getTime()
    ? ok("createdAt unchanged")
    : fail("createdAt mutated by update");

  // ── 5 ── findUserByPhone repository function
  banner("STEP 5  findUserByPhone(...) returns the user");
  const looked = await findUserByPhone(PHONE);
  looked ? ok(`found user ${looked.id} via repository`) : fail("findUserByPhone returned null");
  looked?.firstName === "Rahul" ? ok("repository read returns updated fields") : fail("stale read");

  // ── 6 ── Unique phone constraint — try direct insert with same phone
  banner("STEP 6  Duplicate phone insert MUST fail (unique sparse index)");
  try {
    await UserModel.create({
      phone: PHONE,
      role: "user",
      isPhoneVerified: true,
      isActive: true,
    });
    fail("duplicate insert succeeded — index broken!");
  } catch (err) {
    const e = err as { code?: number; message: string };
    e.code === 11000
      ? ok(`E11000 duplicate key error caught as expected`)
      : fail(`wrong error type: ${e.message}`);
  }

  // ── 7 ── Soft delete: original doc remains, but findUserByPhone returns null
  banner("STEP 7  Soft delete — record stays, but is hidden from queries");
  const userId = looked!.id;
  await softDeleteUser(userId);

  const afterDelete = await UserModel.collection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
  console.log("  Raw doc after soft delete:");
  console.log(JSON.stringify(afterDelete, null, 2));

  afterDelete !== null ? ok("doc still present in collection") : fail("doc was hard-deleted!");
  afterDelete?.deletedAt instanceof Date ? ok("deletedAt timestamp set") : fail("deletedAt not set");
  afterDelete?.isActive === false
    ? ok("isActive flipped to false")
    : fail(`isActive=${afterDelete?.isActive}`);

  const lookedAfterDelete = await findUserByPhone(PHONE);
  lookedAfterDelete === null
    ? ok("findUserByPhone returns null for soft-deleted user")
    : fail("findUserByPhone leaks soft-deleted users");

  // ── 8 ── Re-register the same phone after soft-delete (partial index allows this)
  banner("STEP 8  Same phone can register again after soft delete");
  await getRedisClient()!.flushall();
  res = await request(app).post("/api/v1/auth/otp/send").send({ phone: PHONE });
  const newCode = res.body.devOtp;
  res = await request(app)
    .post("/api/v1/auth/otp/verify")
    .send({ phone: PHONE, otp: newCode });
  res.status === 200
    ? ok(`re-registration succeeded → new userId ${res.body.user.id}`)
    : fail(`re-registration failed: ${JSON.stringify(res.body)}`);
  res.body.user.id !== userId
    ? ok("new userId differs from soft-deleted user")
    : fail("same _id reused");

  const allDocs = await UserModel.collection.countDocuments({});
  allDocs === 2 ? ok(`collection now has 2 docs (1 deleted + 1 active)`) : fail(`count=${allDocs}`);

  await stopTestInfra();
  console.log(`\n${process.exitCode ? "✗ FAILURES ABOVE" : "✓ ALL DB CHECKS PASSED"}\n`);
}

main().catch((err) => {
  console.error("DB verify failed:", err);
  process.exit(1);
});
