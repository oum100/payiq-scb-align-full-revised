// import { PrismaClient } from "@prisma/client";
// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// export const prisma =
//   globalForPrisma.prisma ??
//   new PrismaClient({
//     log: ["warn", "error"],
//   });

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// server/lib/prisma.ts

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// ตัวแปรภายในสำหรับ Production
const actualPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });
if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = actualPrisma;

// สร้าง Proxy เพื่อเป็นตัวกลาง
// ทุกที่ที่ import { prisma } จะได้ Proxy ตัวนี้ไป
export const prisma = new Proxy(actualPrisma, {
  get(target, prop, receiver) {
    // ถ้าอยู่ในโหมดเทส และมีการตั้งค่า Mock ไว้ใน globalThis ให้ใช้ตัว Mock
    const mockPrisma = (globalThis as any).__MOCK_PRISMA__;
    return Reflect.get(mockPrisma || target, prop, receiver);
  },
});
