import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";

// Helper logs in seeded users and returns a bearer token for protected endpoint tests.
async function login(email: string, password = "Password123!") {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

// Covers student safety/reporting flows plus duplicate transaction protection.
describe("reports, chat, and lodge claims", () => {
  it("allows a student to report a lodge", async () => {
    const token = await login("student@ziklodge.test");
    const response = await request(app)
      .post("/api/lodges/ldg_green_haven/report")
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "The listing details look suspicious and need admin review." });
    expect(response.status).toBe(201);
  });

  it("creates a chat thread between student and listing agent", async () => {
    const token = await login("student@ziklodge.test");
    const response = await request(app)
      .post("/api/lodges/ldg_green_haven/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ body: "Is this room still available?" });
    expect(response.status).toBe(201);
    expect(response.body.messages).toHaveLength(1);
  });

  it("creates one pending transaction when student clicks I Got This Lodge", async () => {
    const token = await login("student@ziklodge.test");
    const first = await request(app)
      .post("/api/transaction/initiate")
      .set("Authorization", `Bearer ${token}`)
      .send({ lodgeId: "ldg_green_haven" });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/transaction/initiate")
      .set("Authorization", `Bearer ${token}`)
      .send({ lodgeId: "ldg_green_haven" });
    expect(duplicate.status).toBe(409);
  });
});
