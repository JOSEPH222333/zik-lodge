export type Role = "student" | "agent" | "admin";
export type LodgeStatus = "pending" | "approved" | "rejected" | "occupied";
export type CommissionMode = "fixed" | "percentage";
export type VerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";
export type TransactionStatus = "pending_confirmation" | "confirmed" | "rejected";

// Core domain entities shared by the API, in-memory store, and tests.
export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  passwordHash: string;
  role: Role;
  verified: boolean;
  emailVerified: boolean;
  accountStatus: "active" | "pending" | "restricted";
  securityStamp: string;
  banned: boolean;
  createdAt: string;
  updatedAt: string;
};

// Listings move from pending to approved/occupied as admins and agents review activity.
export type Lodge = {
  id: string;
  agentId: string;
  universityId: string;
  title: string;
  description: string;
  location: string;
  type: string;
  price: number;
  distanceKm: number;
  availableRooms: number;
  status: LodgeStatus;
  images: string[];
  amenities: string[];
  createdAt: string;
};

// Deals represent the older "student marked" flow; Transaction is the commission ledger.
export type Deal = {
  id: string;
  lodgeId: string;
  studentId: string;
  agentId: string;
  rentAmount: number;
  commissionAmount: number;
  status: "student_marked" | "agent_confirmed" | "admin_settled";
  createdAt: string;
};

// Reports, verification, wallets, notifications, messages, OTPs, and audits support trust flows.
export type Report = {
  id: string;
  lodgeId: string;
  studentId: string;
  reason: string;
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
};

export type AgentProfile = {
  id: string;
  userId: string;
  nin: string;
  ninDocumentUrl: string;
  agentPhotoUrl: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  idDocumentUrl: string;
  selfieUrl?: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type VerificationRequest = {
  id: string;
  agentId: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedBy?: string;
  notes?: string;
};

export type Transaction = {
  id: string;
  lodgeId: string;
  studentId: string;
  agentId: string;
  amountPaid?: number;
  commissionAmount: number;
  status: TransactionStatus;
  createdAt: string;
};

export type AgentWallet = {
  id: string;
  agentId: string;
  totalEarnings: number;
  pendingEarnings: number;
  availableBalance: number;
};

export type Notification = {
  id: string;
  audience: "admin" | "agent" | "student";
  targetUserId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type MessageThread = {
  id: string;
  lodgeId: string;
  studentId: string;
  agentId: string;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string;
  }>;
  updatedAt: string;
};

export type EmailOtp = {
  email: string;
  codeHash: string;
  purpose: "signup" | "password_reset";
  attempts: number;
  expiresAt: number;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  details: Record<string, string | number | boolean | null>;
  previousHash: string;
  hash: string;
  createdAt: string;
};
