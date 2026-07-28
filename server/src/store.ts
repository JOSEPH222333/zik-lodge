import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
import { AgentProfile, AgentWallet, AuditEvent, CommissionMode, Deal, EmailOtp, Lodge, MessageThread, Notification, Report, Transaction, User, VerificationRequest } from "./types.js";

dotenv.config({ path: new URL("../.env", import.meta.url) });

// This in-memory store powers the prototype and tests; replace these arrays with a database in production.
const now = () => new Date().toISOString();
const auditSecret = process.env.AUDIT_SECRET ?? "dev-audit-secret-change-me";

type UserIntegrityFields = Pick<User, "id" | "name" | "email" | "phone" | "role" | "verified" | "emailVerified" | "accountStatus" | "banned" | "createdAt">;

// HMAC stamp helps detect accidental or unauthorized changes to sensitive user fields.
export function signUserRecord(user: UserIntegrityFields) {
  return crypto.createHmac("sha256", auditSecret).update(JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    verified: user.verified,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    banned: user.banned,
    createdAt: user.createdAt
  })).digest("hex");
}

// Seed users are signed immediately so securityVerified works for demo accounts too.
function securedUser(user: Omit<User, "securityStamp" | "updatedAt">): User {
  return { ...user, securityStamp: signUserRecord(user), updatedAt: user.createdAt };
}

// Default accounts make local development and dashboard testing possible without setup.
export const users: User[] = [
  securedUser({
    id: "usr_admin",
    name: process.env.ADMIN_NAME ?? "Zik Lodge Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@ziklodge.test",
    phone: process.env.ADMIN_PHONE ?? "+2348000000000",
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD ?? "Password123!", 10),
    role: "admin",
    verified: true,
    emailVerified: true,
    accountStatus: "active",
    banned: false,
    createdAt: now()
  }),
  securedUser({
    id: "usr_agent",
    name: "Adaeze Okafor",
    email: "agent@ziklodge.test",
    phone: "+2348031112048",
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
    passwordHash: bcrypt.hashSync("Password123!", 10),
    role: "agent",
    verified: true,
    emailVerified: true,
    accountStatus: "active",
    banned: false,
    createdAt: now()
  }),
  securedUser({
    id: "usr_student",
    name: "Ngozi Eze",
    email: "student@ziklodge.test",
    phone: "+2348060000000",
    passwordHash: bcrypt.hashSync("Password123!", 10),
    role: "student",
    verified: true,
    emailVerified: true,
    accountStatus: "active",
    banned: false,
    createdAt: now()
  })
];

// Starter lodge data is returned by public listing endpoints.
export const lodges: Lodge[] = [
  {
    id: "ldg_green_haven",
    agentId: "usr_agent",
    universityId: "unizik",
    title: "Green Haven Lodge",
    description: "Modern self-contained rooms with steady water, prepaid meter, tiled interior, and quick access to UNIZIK gate.",
    location: "Ifite, Awka",
    type: "Self-contained",
    price: 420000,
    distanceKm: 0.8,
    availableRooms: 6,
    status: "approved",
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80"
    ],
    amenities: ["Water", "Prepaid meter", "Security", "Parking"],
    createdAt: now()
  }
];

// Mutable collections below represent the app's runtime state while the server is running.
export const reports: Report[] = [];
export const deals: Deal[] = [];
export const registeredIps = new Set<string>();
export const agentProfiles: AgentProfile[] = [];
export const verificationRequests: VerificationRequest[] = [];
export const transactions: Transaction[] = [];
export const agentWallets: AgentWallet[] = [];
export const notifications: Notification[] = [];
export const messageThreads: MessageThread[] = [];
export const emailOtps: EmailOtp[] = [];
export const auditEvents: AuditEvent[] = [];
export const platformRevenue = {
  total: 0
};

// Admins can change this at runtime through commission endpoints.
export const commissionSettings = {
  mode: "percentage" as CommissionMode,
  value: 10
};

// Public user payload strips passwordHash and includes integrity verification metadata.
export function publicUser(user: User) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return { ...safeUser, securityVerified: user.securityStamp === signUserRecord(user) };
}

// Prefixes make generated IDs readable in API responses and test output.
export function createId(prefix: string) {
  return `${prefix}_${nanoid(10)}`;
}

// Central commission calculator for older deal flows.
export function calculateCommission(rentAmount: number) {
  if (commissionSettings.mode === "fixed") return commissionSettings.value;
  return Math.round((rentAmount * commissionSettings.value) / 100);
}

// Notifications are inserted newest-first for dashboard feeds.
export function pushNotification(notification: Omit<Notification, "id" | "createdAt" | "read">) {
  const next = {
    id: createId("ntf"),
    createdAt: now(),
    read: false,
    ...notification
  };
  notifications.unshift(next);
  return next;
}

// Re-stamp users whenever admin or auth flows mutate protected fields.
export function stampUser(user: User) {
  user.updatedAt = now();
  user.securityStamp = signUserRecord(user);
  return user;
}

// Audit events form a simple hash chain so tampering is easier to spot.
export function createAuditEvent(event: Omit<AuditEvent, "id" | "createdAt" | "previousHash" | "hash">) {
  const previousHash = auditEvents[0]?.hash ?? "genesis";
  const createdAt = now();
  const unsigned = { ...event, previousHash, createdAt };
  const hash = crypto.createHmac("sha256", auditSecret).update(JSON.stringify(unsigned)).digest("hex");
  const auditEvent = { id: createId("aud"), ...unsigned, hash };
  auditEvents.unshift(auditEvent);
  return auditEvent;
}
