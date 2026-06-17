import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().regex(/^\+?\d[\d\s-]{7,18}$/, "Valid phone number is required"),
  password: z.string().min(8),
  role: z.enum(["student", "agent"]).default("student"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  photoUrl: z.string().min(10).optional(),
  nin: z.string().regex(/^\d{11}$/, "NIN must be exactly 11 digits").optional(),
  ninDocumentUrl: z.string().min(10).optional()
}).superRefine((data, ctx) => {
  if (data.role === "agent") {
    if (!data.photoUrl) ctx.addIssue({ code: "custom", path: ["photoUrl"], message: "Agent image is required" });
    if (!data.nin) ctx.addIssue({ code: "custom", path: ["nin"], message: "Valid NIN is required" });
    if (!data.ninDocumentUrl) ctx.addIssue({ code: "custom", path: ["ninDocumentUrl"], message: "NIN image upload is required" });
  }
});

export const otpRequestSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

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

export const agentVerificationSchema = z.object({
  fullName: z.string().min(2).max(80),
  nin: z.string().regex(/^\d{11}$/, "NIN must be exactly 11 digits"),
  phone: z.string().min(7).max(30),
  ninDocumentUrl: z.string().min(10),
  agentPhotoUrl: z.string().min(10),
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
