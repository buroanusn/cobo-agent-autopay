import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __agentToTokenPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.__agentToTokenPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__agentToTokenPrisma = prisma;
}
