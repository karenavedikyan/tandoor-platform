import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __tandoorPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__tandoorPrisma) {
    globalForPrisma.__tandoorPrisma = new PrismaClient();
  }
  return globalForPrisma.__tandoorPrisma;
}
