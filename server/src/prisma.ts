import { PrismaClient } from "@prisma/client";

// Reuse a single Prisma client during development hot reloads to avoid connection churn.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
