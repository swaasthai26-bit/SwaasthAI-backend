import express from "express";
import request from "supertest";
import { responseFormatter } from "../src/middleware/responseFormatter";

function testApp() {
  const app = express();
  app.use(responseFormatter);
  app.get("/empty", (_req, res) => res.json({ data: [] }));
  app.get("/list", (_req, res) => res.json({ data: [{ id: "1" }] }));
  app.post("/items", (_req, res) => res.json({ data: { id: "1" } }));
  app.post("/api/v1/auth/otp/send", (_req, res) =>
    res.json({ message: "OTP sent successfully" }),
  );
  app.post("/api/v1/me/change-phone/otp/send", (_req, res) =>
    res.json({ message: "OTP sent successfully" }),
  );
  app.patch("/items/:id", (_req, res) => res.json({ data: { id: "1" } }));
  app.delete("/items/:id", (_req, res) => res.json({}));
  app.delete("/explicit/:id", (_req, res) =>
    res.json({ message: "Hospital deleted successfully" }),
  );
  return app;
}

describe("responseFormatter", () => {
  const app = testApp();

  it("shows a data-unavailable message for an empty response", async () => {
    const response = await request(app).get("/empty");

    expect(response.body).toEqual({
      status: true,
      message: "Data fetched successfully",
      data: "Data is not available.",
    });
  });

  it("keeps available response data", async () => {
    const response = await request(app).get("/list");

    expect(response.body.message).toBe("Data fetched successfully");
    expect(response.body.data).toEqual([{ id: "1" }]);
  });

  it.each([
    ["post", "/items", "Data inserted successfully"],
    ["patch", "/items/1", "Data updated successfully"],
    ["delete", "/items/1", "Data deleted successfully"],
  ] as const)(
    "uses an operation-specific message for %s requests",
    async (method, path, message) => {
      const response = await request(app)[method](path);

      expect(response.body.message).toBe(message);
    },
  );

  it("preserves an explicit controller message", async () => {
    const response = await request(app).delete("/explicit/1");

    expect(response.body.message).toBe("Hospital deleted successfully");
    expect(response.body.data).toBe("Data is not available.");
  });

  it.each([
    "/api/v1/auth/otp/send",
    "/api/v1/me/change-phone/otp/send",
  ])("omits data from the OTP send response at %s", async (path) => {
    const response = await request(app).post(path);

    expect(response.body).toEqual({
      status: true,
      message: "OTP sent successfully",
    });
  });
});
