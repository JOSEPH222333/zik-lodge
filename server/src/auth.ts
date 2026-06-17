import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "./types.js";
import { users } from "./store.js";

const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";

export type AuthRequest = Request & {
  user?: {
    id: string;
    role: Role;
  };
};

export function signToken(payload: { id: string; role: Role }) {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: "Authentication required" });

  try {
    const decoded = jwt.verify(token, secret) as { id: string; role: Role };
    const user = users.find((item) => item.id === decoded.id && !item.banned && item.accountStatus !== "restricted");
    if (!user) return res.status(401).json({ message: "User is not allowed" });
    if (user.accountStatus === "pending") return res.status(403).json({ message: "Account is pending admin review" });
    req.user = { id: decoded.id, role: decoded.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}
