// server/api/admin/users/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const items = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, name: true,
      isActive: true, lastLoginAt: true, createdAt: true,
      _count: { select: { sessions: true } },
    },
  })
  return { items }
})
