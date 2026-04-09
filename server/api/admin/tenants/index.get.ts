// server/api/admin/tenants/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const items = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          merchants: true,
          billerProfiles: true,
          paymentRoutes: true,
          apiKeys: true,
          paymentIntents: true,
        },
      },
    },
  })
  return { items }
})
