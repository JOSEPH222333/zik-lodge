import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

async function login(email: string, password = "Password123!") {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

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
});

describe("agent verification and lodge posting", () => {
  it("validates NIN length on verification", async () => {
    const agentToken = await login("agent@ziklodge.test");
    const response = await request(app)
      .post("/api/agent/verify")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        fullName: "Adaeze Okafor",
        nin: "123",
        phone: "+2348031112048",
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
