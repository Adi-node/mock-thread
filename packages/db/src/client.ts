// Prisma client singleton + `@prisma/adapter-pg` driver. Pattern ported from algo-arena:
// cache the client on globalThis so Next.js dev hot-reloads reuse one connection
// pool instead of opening a new one per module rebuild.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "@mt/shared";

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
