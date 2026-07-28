import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().refine((email) => {
  const domain = email.toLowerCase().split("@")[1];
  return Boolean(domain) && !domain.includes("..");
}, "Use a valid email address");
const nigerianPhoneSchema = z.string().regex(/^0\d{10}$/, "Phone number must be exactly 11 digits and start with 0");
const profileImageSchema = z.string().min(10).max(2_800_000, "Profile image must be 2MB or smaller").optional();

// Registration rules enforce email OTP and require stronger identity fields for agents.
export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: emailSchema,
  phone: nigerianPhoneSchema,
  password: z.string().min(8),
  role: z.enum(["student", "agent"]).default("student"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  photoUrl: profileImageSchema,
  nin: z.string().optional(),
  ninDocumentUrl: z.string().min(10).optional()
}).superRefine((data, ctx) => {
  if (!data.photoUrl) ctx.addIssue({ code: "custom", path: ["photoUrl"], message: "Profile image is required" });
});

// Auth and account recovery payloads are intentionally small and strict.
export const otpRequestSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

// Lodge and moderation schemas validate all user-controlled marketplace content.
export const lodgeSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(20).max(1500),
  location: z.string().min(2).max(120),
  type: z.string().min(2).max(80),
  price: z.coerce.number().positive(),
  distanceKm: z.coerce.number().nonnegative(),
  availableRooms: z.coerce.number().int().nonnegative(),
  universityId: z.string().default("unizik"),
  images: z.array(z.string().url()).min(1).max(8),
  amenities: z.array(z.string()).max(20).default([])
});

export const reportSchema = z.object({
  reason: z.string().min(10).max(800)
});

export const commissionSchema = z.object({
  mode: z.enum(["fixed", "percentage"]),
  value: z.coerce.number().positive()
});

// Agent verification captures identity, document, and bank details for admin review.
export const agentVerificationSchema = z.object({
  fullName: z.string().min(2).max(25),
  email: emailSchema.optional(),
  nin: z.string().optional(),
  phone: nigerianPhoneSchema,
  ninDocumentUrl: z.string().min(10).optional(),
  agentPhotoUrl: z.string().min(10).max(2_800_000, "Agent profile image must be 2MB or smaller"),
  bankName: z.string().min(2).max(80),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: z.string().min(2).max(120),
  idDocumentUrl: z.string().min(10),
  selfieUrl: z.string().min(10).optional()
});

export const rejectVerificationSchema = z.object({
  reason: z.string().min(3).max(500)
});

export const messageSchema = z.object({
  body: z.string().min(1).max(1000)
});

export const userStatusSchema = z.object({
  accountStatus: z.enum(["active", "pending", "restricted"])
});
