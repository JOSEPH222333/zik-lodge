import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "node:crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import { AuthRequest, requireAuth, requireRole, signToken } from "./auth.js";
import { computeCommission, getOrCreateWallet } from "./commission.js";
import { sendOtpEmail } from "./email.js";
import { verifyNin } from "./nin.js";
import { uploadBuffer } from "./storage.js";
import { agentVerificationSchema, commissionSchema, lodgeSchema, loginSchema, messageSchema, otpRequestSchema, registerSchema, rejectVerificationSchema, reportSchema, resetPasswordSchema, userStatusSchema } from "./validation.js";
import { agentProfiles, agentWallets, auditEvents, calculateCommission, commissionSettings, createAuditEvent, createId, deals, emailOtps, lodges, messageThreads, notifications, platformRevenue, publicUser, pushNotification, registeredIps, reports, signUserRecord, stampUser, transactions, users, verificationRequests } from "./store.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") return cb(new Error("Only image or PDF uploads are allowed"));
    cb(null, true);
  }
});

app.use(helmet());
app.disable("x-powered-by");
const allowedOrigin = process.env.CLIENT_URL ?? "http://127.0.0.1:5173";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
app.set("trust proxy", 1);
app.use((req, res, next) => {
  if (process.env.ENFORCE_HTTPS === "true" && req.headers["x-forwarded-proto"] !== "https") {
    return res.status(403).json({ message: "HTTPS is required in production" });
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "zik-lodge-api" });
});

function hashOtp(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

app.post("/api/auth/request-otp", async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid email" });

  const email = parsed.data.email.toLowerCase();
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const existingIndex = emailOtps.findIndex((otp) => otp.email === email);
  const otpRecord = {
    email,
    codeHash: hashOtp(code),
    purpose: "signup" as const,
    attempts: 0,
    expiresAt: Date.now() + 10 * 60_000,
    createdAt: new Date().toISOString()
  };
  if (existingIndex >= 0) emailOtps[existingIndex] = otpRecord;
  else emailOtps.push(otpRecord);

  const delivery = await sendOtpEmail({ to: email, code, purpose: "signup" });
  res.json({
    message: "OTP sent to email.",
    emailDelivered: delivery.delivered,
    devOtp: process.env.NODE_ENV === "production" ? undefined : code
  });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid email" });
  const email = parsed.data.email.toLowerCase();
  const user = users.find((item) => item.email.toLowerCase() === email);
  if (!user) return res.json({ message: "If that email exists, a reset OTP has been sent." });

  const code = crypto.randomInt(100000, 999999).toString();
  const existingIndex = emailOtps.findIndex((otp) => otp.email === email && otp.purpose === "password_reset");
  const otpRecord = {
    email,
    codeHash: hashOtp(code),
    purpose: "password_reset" as const,
    attempts: 0,
    expiresAt: Date.now() + 10 * 60_000,
    createdAt: new Date().toISOString()
  };
  if (existingIndex >= 0) emailOtps[existingIndex] = otpRecord;
  else emailOtps.push(otpRecord);

  const delivery = await sendOtpEmail({ to: email, code, purpose: "password_reset" });
  res.json({
    message: "If that email exists, a reset OTP has been sent.",
    emailDelivered: delivery.delivered,
    devOtp: process.env.NODE_ENV === "production" ? undefined : code
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid reset data", errors: parsed.error.flatten() });
  const email = parsed.data.email.toLowerCase();
  const user = users.find((item) => item.email.toLowerCase() === email);
  if (!user) return res.status(400).json({ message: "Invalid reset request" });
  const otp = emailOtps.find((item) => item.email === email && item.purpose === "password_reset");
  if (!otp || otp.expiresAt < Date.now()) return res.status(400).json({ message: "OTP has expired. Request a new OTP." });
  if (otp.attempts >= 5) return res.status(429).json({ message: "Too many OTP attempts. Request a new OTP." });
  if (otp.codeHash !== hashOtp(parsed.data.otp)) {
    otp.attempts += 1;
    return res.status(400).json({ message: "Invalid OTP" });
  }
  user.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  stampUser(user);
  emailOtps.splice(emailOtps.findIndex((item) => item.email === email && item.purpose === "password_reset"), 1);
  createAuditEvent({ actorId: user.id, action: "auth.password_reset", targetId: user.id, details: { email } });
  res.json({ message: "Password reset successful. You can log in now." });
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid registration data", errors: parsed.error.flatten() });
  if (users.some((user) => user.email.toLowerCase() === parsed.data.email.toLowerCase())) {
    return res.status(409).json({ message: "Email already exists" });
  }
  const forwardedFor = req.headers["x-forwarded-for"];
  const ipAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0] || req.ip || req.socket.remoteAddress || "unknown";
  const ipKey = ipAddress.trim();
  if (registeredIps.has(ipKey)) {
    return res.status(409).json({ message: "Only one account can be created from this IP address" });
  }
  const otp = emailOtps.find((item) => item.email === parsed.data.email.toLowerCase() && item.purpose === "signup");
  if (!otp || otp.expiresAt < Date.now()) return res.status(400).json({ message: "OTP has expired. Request a new OTP." });
  if (otp.attempts >= 5) return res.status(429).json({ message: "Too many OTP attempts. Request a new OTP." });
  if (otp.codeHash !== hashOtp(parsed.data.otp)) {
    otp.attempts += 1;
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (parsed.data.role === "agent") {
    const ninCheck = await verifyNin(parsed.data.nin!);
    if (!ninCheck.verified && process.env.NODE_ENV === "production") {
      return res.status(400).json({ message: ninCheck.reason ?? "NIN verification failed" });
    }
  }

  const user = {
    id: createId("usr"),
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone,
    photoUrl: parsed.data.photoUrl,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: parsed.data.role,
    verified: parsed.data.role === "student",
    emailVerified: true,
    accountStatus: parsed.data.role === "agent" ? "pending" as const : "active" as const,
    securityStamp: "",
    banned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  user.securityStamp = signUserRecord(user);
  users.push(user);
  createAuditEvent({
    actorId: user.id,
    action: "account.registered",
    targetId: user.id,
    details: { role: user.role, email: user.email, accountStatus: user.accountStatus }
  });
  pushNotification({
    audience: "admin",
    title: "New account registered",
    body: `${user.name} joined as ${user.role}. Status: ${user.accountStatus}.`
  });
  if (parsed.data.role === "agent") {
    agentProfiles.push({
      id: createId("agp"),
      userId: user.id,
      nin: parsed.data.nin!,
      phone: parsed.data.phone,
      ninDocumentUrl: parsed.data.ninDocumentUrl!,
      agentPhotoUrl: parsed.data.photoUrl!,
      bankName: "Pending",
      accountNumber: "0000000000",
      accountName: parsed.data.name,
      idDocumentUrl: parsed.data.ninDocumentUrl!,
      verificationStatus: "pending_review",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    verificationRequests.push({ id: createId("ver"), agentId: user.id, status: "pending_review", submittedAt: new Date().toISOString() });
    pushNotification({
      audience: "admin",
      title: "Agent awaiting verification",
      body: `${user.name} registered as an agent and submitted NIN details.`
    });
  }
  emailOtps.splice(emailOtps.findIndex((item) => item.email === user.email && item.purpose === "signup"), 1);
  registeredIps.add(ipKey);
  res.status(201).json({ user: publicUser(user), token: signToken({ id: user.id, role: user.role }) });
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid login data" });
  const user = users.find((item) => item.email === parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    createAuditEvent({
      actorId: "anonymous",
      action: "auth.login_failed",
      targetId: parsed.data.email.toLowerCase(),
      details: { email: parsed.data.email.toLowerCase() }
    });
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (user.banned) return res.status(403).json({ message: "Account has been banned" });
  if (user.accountStatus === "restricted") return res.status(403).json({ message: "Account has been restricted by admin" });
  if (!user.emailVerified) return res.status(403).json({ message: "Email OTP verification is required" });
  res.json({ user: publicUser(user), token: signToken({ id: user.id, role: user.role }) });
});

app.get("/api/lodges", (req, res) => {
  const { location, type, maxPrice, universityId = "unizik" } = req.query;
  const result = lodges.filter((lodge) => {
    const approved = lodge.status === "approved";
    const matchesUniversity = lodge.universityId === universityId;
    const matchesLocation = !location || lodge.location.toLowerCase().includes(String(location).toLowerCase());
    const matchesType = !type || lodge.type === type;
    const matchesPrice = !maxPrice || lodge.price <= Number(maxPrice);
    return approved && matchesUniversity && matchesLocation && matchesType && matchesPrice;
  });
  res.json(result);
});

app.get("/api/lodges/:id", (req, res) => {
  const lodge = lodges.find((item) => item.id === req.params.id);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  res.json(lodge);
});

app.post("/api/lodges", requireAuth, requireRole("agent", "admin"), (req: AuthRequest, res) => {
  const parsed = lodgeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid lodge data", errors: parsed.error.flatten() });
  const currentUser = users.find((user) => user.id === req.user?.id);
  if (currentUser?.role === "agent" && (!currentUser.verified || currentUser.accountStatus !== "active")) return res.status(403).json({ message: "Admin must verify your agent account before you can list a lodge" });

  const lodge = {
    id: createId("ldg"),
    agentId: req.user!.id,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    ...parsed.data
  };
  lodges.push(lodge);
  res.status(201).json(lodge);
});

app.patch("/api/lodges/:id/status", requireAuth, requireRole("agent", "admin"), (req: AuthRequest, res) => {
  const lodge = lodges.find((item) => item.id === req.params.id);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  if (req.user?.role === "agent" && lodge.agentId !== req.user.id) return res.status(403).json({ message: "You can update only your listings" });
  if (!["pending", "approved", "rejected", "occupied"].includes(req.body.status)) return res.status(400).json({ message: "Invalid status" });
  lodge.status = req.body.status;
  res.json(lodge);
});

app.post("/api/lodges/:id/report", requireAuth, requireRole("student"), (req: AuthRequest, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid report data" });
  const lodge = lodges.find((item) => item.id === req.params.id);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  const report = { id: createId("rpt"), lodgeId: lodge.id, studentId: req.user!.id, reason: parsed.data.reason, status: "open" as const, createdAt: new Date().toISOString() };
  reports.push(report);
  pushNotification({
    audience: "admin",
    title: "New lodge report",
    body: `A student reported lodge ${lodge.title}: ${parsed.data.reason}`
  });
  res.status(201).json(report);
});

app.post("/api/lodges/:id/got-this", requireAuth, requireRole("student"), (req: AuthRequest, res) => {
  const lodge = lodges.find((item) => item.id === req.params.id);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  const deal = {
    id: createId("deal"),
    lodgeId: lodge.id,
    studentId: req.user!.id,
    agentId: lodge.agentId,
    rentAmount: lodge.price,
    commissionAmount: calculateCommission(lodge.price),
    status: "student_marked" as const,
    createdAt: new Date().toISOString()
  };
  deals.push(deal);
  pushNotification({
    audience: "agent",
    targetUserId: lodge.agentId,
    title: "Student clicked I got this lodge",
    body: `A student marked ${lodge.title}. Confirm the deal from your dashboard.`
  });
  res.status(201).json(deal);
});

app.post("/api/agent/verify", requireAuth, requireRole("agent"), async (req: AuthRequest, res) => {
  const parsed = agentVerificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid verification data", errors: parsed.error.flatten() });
  const ninCheck = await verifyNin(parsed.data.nin);
  if (!ninCheck.verified && process.env.NODE_ENV === "production") {
    return res.status(400).json({ message: ninCheck.reason ?? "NIN verification failed" });
  }

  const existing = agentProfiles.find((profile) => profile.userId === req.user!.id);
  const timestamp = new Date().toISOString();
  if (existing) {
    Object.assign(existing, {
      ...parsed.data,
      verificationStatus: "pending_review",
      rejectionReason: undefined,
      updatedAt: timestamp
    });
  } else {
    agentProfiles.push({
      id: createId("agp"),
      userId: req.user!.id,
      ...parsed.data,
      verificationStatus: "pending_review",
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  const request = {
    id: createId("ver"),
    agentId: req.user!.id,
    status: "pending_review" as const,
    submittedAt: timestamp
  };
  verificationRequests.push(request);
  res.status(201).json({ profile: agentProfiles.find((profile) => profile.userId === req.user!.id), request });
});

app.post("/api/agent/upload-documents", requireAuth, requireRole("agent"), upload.fields([{ name: "idDocument", maxCount: 1 }, { name: "selfie", maxCount: 1 }]), async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const idDocument = files?.idDocument?.[0];
  const selfie = files?.selfie?.[0];
  if (!idDocument) return res.status(400).json({ message: "Government ID document is required" });

  const idDocumentUpload = await uploadBuffer(idDocument, "agent-documents");
  const selfieUpload = selfie ? await uploadBuffer(selfie, "agent-documents") : undefined;
  res.status(201).json({
    idDocumentUrl: idDocumentUpload.url,
    selfieUrl: selfieUpload?.url,
    devFallback: idDocumentUpload.devFallback || Boolean(selfieUpload?.devFallback)
  });
});

app.get("/api/agent/status", requireAuth, requireRole("agent"), (req: AuthRequest, res) => {
  const profile = agentProfiles.find((item) => item.userId === req.user!.id);
  res.json({
    verificationStatus: profile?.verificationStatus ?? "unverified",
    rejectionReason: profile?.rejectionReason,
    profile
  });
});

app.get("/api/notifications", requireAuth, (req: AuthRequest, res) => {
  const currentUser = users.find((user) => user.id === req.user!.id);
  res.json(notifications.filter((notification) => notification.audience === currentUser?.role && (!notification.targetUserId || notification.targetUserId === req.user!.id)));
});

app.get("/api/admin/notifications", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(notifications.filter((notification) => notification.audience === "admin"));
});

app.get("/api/messages", requireAuth, (req: AuthRequest, res) => {
  res.json(messageThreads.filter((thread) => thread.studentId === req.user!.id || thread.agentId === req.user!.id));
});

app.post("/api/lodges/:id/messages", requireAuth, requireRole("student", "agent"), (req: AuthRequest, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Message is required" });
  const lodge = lodges.find((item) => item.id === req.params.id);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  if (req.user!.role === "agent" && lodge.agentId !== req.user!.id) return res.status(403).json({ message: "You can message only on your own listings" });

  const studentId = req.user!.role === "student" ? req.user!.id : String(req.body.studentId ?? "");
  if (!studentId) return res.status(400).json({ message: "studentId is required when an agent starts a reply" });
  let thread = messageThreads.find((item) => item.lodgeId === lodge.id && item.studentId === studentId && item.agentId === lodge.agentId);
  if (!thread) {
    thread = { id: createId("msg"), lodgeId: lodge.id, studentId, agentId: lodge.agentId, messages: [], updatedAt: new Date().toISOString() };
    messageThreads.unshift(thread);
  }
  thread.messages.push({ id: createId("chat"), senderId: req.user!.id, body: parsed.data.body, createdAt: new Date().toISOString() });
  thread.updatedAt = new Date().toISOString();
  pushNotification({
    audience: req.user!.role === "student" ? "agent" : "student",
    targetUserId: req.user!.role === "student" ? lodge.agentId : studentId,
    title: "New in-site message",
    body: `New message about ${lodge.title}`
  });
  res.status(201).json(thread);
});

app.post("/api/transaction/initiate", requireAuth, requireRole("student"), (req: AuthRequest, res) => {
  const { lodgeId, amountPaid } = req.body as { lodgeId?: string; amountPaid?: number };
  if (!lodgeId) return res.status(400).json({ message: "lodgeId is required" });
  const lodge = lodges.find((item) => item.id === lodgeId);
  if (!lodge) return res.status(404).json({ message: "Lodge not found" });
  const duplicate = transactions.find((item) => item.lodgeId === lodgeId && item.studentId === req.user!.id && item.status !== "rejected");
  if (duplicate) return res.status(409).json({ message: "You already submitted this lodge transaction", transaction: duplicate });

  const transaction = {
    id: createId("txn"),
    lodgeId: lodge.id,
    studentId: req.user!.id,
    agentId: lodge.agentId,
    amountPaid: amountPaid ?? lodge.price,
    commissionAmount: computeCommission(lodge.price, commissionSettings),
    status: "pending_confirmation" as const,
    createdAt: new Date().toISOString()
  };
  transactions.push(transaction);
  const wallet = getOrCreateWallet(agentWallets, lodge.agentId);
  wallet.pendingEarnings += transaction.commissionAmount;
  pushNotification({
    audience: "agent",
    targetUserId: lodge.agentId,
    title: "Student clicked I got this lodge",
    body: `A student submitted a lodge claim for ${lodge.title}.`
  });
  res.status(201).json(transaction);
});

app.get("/api/transactions/my", requireAuth, requireRole("student"), (req: AuthRequest, res) => {
  res.json(transactions.filter((transaction) => transaction.studentId === req.user!.id));
});

app.get("/api/transactions/agent", requireAuth, requireRole("agent"), (req: AuthRequest, res) => {
  res.json(transactions.filter((transaction) => transaction.agentId === req.user!.id));
});

app.post("/api/transaction/confirm/:id", requireAuth, requireRole("agent"), (req: AuthRequest, res) => {
  const currentUser = users.find((user) => user.id === req.user!.id);
  if (!currentUser?.verified) return res.status(403).json({ message: "Only verified agents can confirm transactions" });
  const transaction = transactions.find((item) => item.id === req.params.id);
  if (!transaction) return res.status(404).json({ message: "Transaction not found" });
  if (transaction.agentId !== req.user!.id) return res.status(403).json({ message: "You can confirm only your transactions" });
  if (transaction.status !== "pending_confirmation") return res.status(409).json({ message: "Transaction is not pending" });

  transaction.status = "confirmed";
  const wallet = getOrCreateWallet(agentWallets, transaction.agentId);
  wallet.pendingEarnings = Math.max(0, wallet.pendingEarnings - transaction.commissionAmount);
  wallet.availableBalance += transaction.commissionAmount;
  wallet.totalEarnings += transaction.commissionAmount;
  platformRevenue.total += transaction.commissionAmount;
  const lodge = lodges.find((item) => item.id === transaction.lodgeId);
  if (lodge) lodge.status = "occupied";
  res.json({ transaction, wallet, platformRevenue });
});

app.post("/api/transaction/reject/:id", requireAuth, requireRole("agent"), (req: AuthRequest, res) => {
  const transaction = transactions.find((item) => item.id === req.params.id);
  if (!transaction) return res.status(404).json({ message: "Transaction not found" });
  if (transaction.agentId !== req.user!.id) return res.status(403).json({ message: "You can reject only your transactions" });
  if (transaction.status !== "pending_confirmation") return res.status(409).json({ message: "Transaction is not pending" });
  transaction.status = "rejected";
  const wallet = getOrCreateWallet(agentWallets, transaction.agentId);
  wallet.pendingEarnings = Math.max(0, wallet.pendingEarnings - transaction.commissionAmount);
  res.json({ transaction, wallet });
});

app.get("/api/transactions/all", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(transactions);
});

app.post("/api/admin/set-commission", requireAuth, requireRole("admin"), (req, res) => {
  const parsed = commissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid commission settings" });
  commissionSettings.mode = parsed.data.mode;
  commissionSettings.value = parsed.data.value;
  res.json(commissionSettings);
});

app.get("/api/admin/analytics", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({
    transactionCount: transactions.length,
    confirmedTransactions: transactions.filter((transaction) => transaction.status === "confirmed").length,
    platformRevenue: platformRevenue.total,
    wallets: agentWallets
  });
});

app.post("/api/admin/approve-payout/:agentId", requireAuth, requireRole("admin"), (req, res) => {
  const wallet = getOrCreateWallet(agentWallets, String(req.params.agentId));
  wallet.availableBalance = 0;
  res.json({ message: "Payout approved", wallet });
});

app.patch("/api/deals/:id/confirm", requireAuth, requireRole("agent", "admin"), (req: AuthRequest, res) => {
  const deal = deals.find((item) => item.id === req.params.id);
  if (!deal) return res.status(404).json({ message: "Deal not found" });
  if (req.user?.role === "agent" && deal.agentId !== req.user.id) return res.status(403).json({ message: "You can confirm only your deals" });
  deal.status = "agent_confirmed";
  const lodge = lodges.find((item) => item.id === deal.lodgeId);
  if (lodge) lodge.status = "occupied";
  res.json(deal);
});

app.get("/api/admin/overview", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({
    users: users.map(publicUser),
    pendingAgents: users.filter((user) => user.role === "agent" && !user.verified),
    pendingListings: lodges.filter((lodge) => lodge.status === "pending"),
    reports,
    deals,
    commissionSettings,
    agentProfiles,
    verificationRequests,
    transactions,
    agentWallets,
    platformRevenue
  });
});

app.get("/api/admin/pending-verifications", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(agentProfiles.filter((profile) => profile.verificationStatus === "pending_review"));
});

app.post("/api/admin/approve-agent/:id", requireAuth, requireRole("admin"), (req: AuthRequest, res) => {
  const profile = agentProfiles.find((item) => item.userId === req.params.id || item.id === req.params.id);
  if (!profile) return res.status(404).json({ message: "Verification profile not found" });
  profile.verificationStatus = "verified";
  profile.rejectionReason = undefined;
  profile.updatedAt = new Date().toISOString();
  const agent = users.find((user) => user.id === profile.userId);
  if (agent) agent.verified = true;
  if (agent) {
    agent.accountStatus = "active";
    stampUser(agent);
  }
  verificationRequests.push({ id: createId("ver"), agentId: profile.userId, status: "verified", submittedAt: new Date().toISOString(), reviewedBy: req.user!.id });
  createAuditEvent({
    actorId: req.user!.id,
    action: "agent.verified",
    targetId: profile.userId,
    details: { verificationStatus: "verified" }
  });
  pushNotification({
    audience: "admin",
    title: "Agent verified",
    body: `${agent?.name ?? "Agent"} was verified and moved to active.`
  });
  res.json({ profile, agent: agent ? publicUser(agent) : undefined });
});

app.post("/api/admin/reject-agent/:id", requireAuth, requireRole("admin"), (req: AuthRequest, res) => {
  const parsed = rejectVerificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Rejection reason is required" });
  const profile = agentProfiles.find((item) => item.userId === req.params.id || item.id === req.params.id);
  if (!profile) return res.status(404).json({ message: "Verification profile not found" });
  profile.verificationStatus = "rejected";
  profile.rejectionReason = parsed.data.reason;
  profile.updatedAt = new Date().toISOString();
  const agent = users.find((user) => user.id === profile.userId);
  if (agent) agent.verified = false;
  if (agent) {
    agent.accountStatus = "pending";
    stampUser(agent);
  }
  verificationRequests.push({ id: createId("ver"), agentId: profile.userId, status: "rejected", submittedAt: new Date().toISOString(), reviewedBy: req.user!.id, notes: parsed.data.reason });
  createAuditEvent({
    actorId: req.user!.id,
    action: "agent.rejected",
    targetId: profile.userId,
    details: { reason: parsed.data.reason }
  });
  pushNotification({
    audience: "admin",
    title: "Agent verification rejected",
    body: `${agent?.name ?? "Agent"} was kept pending. Reason: ${parsed.data.reason}`
  });
  res.json({ profile, agent: agent ? publicUser(agent) : undefined });
});

app.patch("/api/admin/agents/:id/verify", requireAuth, requireRole("admin"), (req: AuthRequest, res) => {
  const user = users.find((item) => item.id === req.params.id && item.role === "agent");
  if (!user) return res.status(404).json({ message: "Agent not found" });
  user.verified = Boolean(req.body.verified);
  user.accountStatus = user.verified ? "active" : "pending";
  stampUser(user);
  createAuditEvent({
    actorId: req.user!.id,
    action: "agent.verify_flag_changed",
    targetId: user.id,
    details: { verified: user.verified, accountStatus: user.accountStatus }
  });
  pushNotification({
    audience: "admin",
    title: "Agent verification changed",
    body: `${user.name} is now ${user.accountStatus}.`
  });
  res.json(publicUser(user));
});

app.patch("/api/admin/users/:id/status", requireAuth, requireRole("admin"), (req: AuthRequest, res) => {
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid account status" });
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const previousStatus = user.accountStatus;
  user.accountStatus = parsed.data.accountStatus;
  user.banned = parsed.data.accountStatus === "restricted";
  if (user.role === "agent" && parsed.data.accountStatus !== "active") user.verified = false;
  stampUser(user);
  createAuditEvent({
    actorId: req.user!.id,
    action: "account.status_changed",
    targetId: user.id,
    details: { previousStatus, nextStatus: user.accountStatus, role: user.role }
  });
  pushNotification({
    audience: "admin",
    title: "Account status changed",
    body: `${user.name} (${user.role}) changed from ${previousStatus} to ${user.accountStatus}.`
  });
  res.json(publicUser(user));
});

app.patch("/api/admin/users/:id/ban", requireAuth, requireRole("admin"), (req, res) => {
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.banned = Boolean(req.body.banned);
  user.accountStatus = user.banned ? "restricted" : user.accountStatus;
  stampUser(user);
  res.json(publicUser(user));
});

app.get("/api/admin/audit", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(auditEvents);
});

app.patch("/api/admin/commission", requireAuth, requireRole("admin"), (req, res) => {
  const parsed = commissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid commission settings" });
  commissionSettings.mode = parsed.data.mode;
  commissionSettings.value = parsed.data.value;
  res.json(commissionSettings);
});

app.post("/api/uploads/lodge-images", requireAuth, requireRole("agent", "admin"), upload.array("images", 8), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.some((file) => !file.mimetype.startsWith("image/"))) {
    return res.status(400).json({ message: "Lodge listings accept image files only" });
  }
  const uploaded = await Promise.all(files.map((file) => uploadBuffer(file, "lodge-images")));
  res.status(201).json({
    files: files.map((file, index) => ({
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: uploaded[index].url,
      publicId: uploaded[index].publicId,
      devFallback: uploaded[index].devFallback
    }))
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ message: err.message || "Request failed" });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, "127.0.0.1", () => {
    console.log(`Zik Lodge API listening on http://127.0.0.1:${port}`);
  });
}

export { app };
