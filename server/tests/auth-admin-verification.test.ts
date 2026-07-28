import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

// Helper logs in seeded users and returns a bearer token for protected endpoint tests.
async function login(email: string, password = "Password123!") {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

// Confirms admin-only endpoints reject anonymous and non-admin access.
describe("auth and admin restrictions", () => {
  it("blocks admin overview without a token", async () => {
    const response = await request(app).get("/api/admin/overview");
    expect(response.status).toBe(401);
  });

  it("allows only admin to view admin overview", async () => {
    const studentToken = await login("student@ziklodge.test");
    const blocked = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${studentToken}`);
    expect(blocked.status).toBe(403);

    const adminToken = await login("admin@ziklodge.test");
    const allowed = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
  });

  it("ties password reset OTPs to the registered account email", async () => {
    const unique = Date.now();
    const email = `reset-${unique}@example.com`;
    const password = "Password123!";
    const newPassword = "NewPassword123!";

    const otpResponse = await request(app).post("/api/auth/request-otp").send({ email: ` ${email.toUpperCase()} ` });
    expect(otpResponse.status).toBe(200);

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Reset Student",
        email,
        phone: "08012345678",
        password,
        role: "student",
        otp: otpResponse.body.devOtp,
        photoUrl: "data:image/png;base64,profile-image"
      });
    expect(registerResponse.status).toBe(201);

    const resetOtpResponse = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(resetOtpResponse.status).toBe(200);

    const wrongEmailReset = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "agent@ziklodge.test", otp: resetOtpResponse.body.devOtp, password: newPassword });
    expect(wrongEmailReset.status).toBe(400);

    const resetResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp: resetOtpResponse.body.devOtp, password: newPassword });
    expect(resetResponse.status).toBe(200);

    const loginResponse = await request(app).post("/api/auth/login").send({ email, password: newPassword });
    expect(loginResponse.status).toBe(200);
  });
});

// Confirms verification validation and approved-agent listing creation.
describe("agent verification and lodge posting", () => {
  it("allows agent verification without NIN while NIN is disabled", async () => {
    const agentToken = await login("agent@ziklodge.test");
    const response = await request(app)
      .post("/api/agent/verify")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        fullName: "Adaeze Okafor",
        phone: "08031112048",
        agentPhotoUrl: "https://example.com/photo.jpg",
        bankName: "FirstBank",
        accountNumber: "3159371980",
        accountName: "Adaeze Okafor",
        idDocumentUrl: "https://example.com/id.jpg"
      });
    expect(response.status).toBe(201);
  });

  it("validates Nigerian phone length on verification", async () => {
    const agentToken = await login("agent@ziklodge.test");
    const response = await request(app)
      .post("/api/agent/verify")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        fullName: "Adaeze Okafor",
        email: "agent@gmail.com",
        nin: "12345678901",
        phone: "8031112048",
        ninDocumentUrl: "https://example.com/nin.jpg",
        agentPhotoUrl: "https://example.com/photo.jpg",
        bankName: "FirstBank",
        accountNumber: "3159371980",
        accountName: "Adaeze Okafor",
        idDocumentUrl: "https://example.com/id.jpg"
      });
    expect(response.status).toBe(400);
  });

  it("lets a verified agent post a lodge", async () => {
    const agentToken = await login("agent@ziklodge.test");
    const response = await request(app)
      .post("/api/lodges")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        title: "Test Lodge",
        description: "A clean verified test room close to UNIZIK gate.",
        location: "Ifite",
        type: "Self-contained",
        price: 250000,
        distanceKm: 1,
        availableRooms: 2,
        universityId: "unizik",
        images: ["https://example.com/room.jpg"],
        amenities: ["Water"]
      });
    expect(response.status).toBe(201);
  });
});
