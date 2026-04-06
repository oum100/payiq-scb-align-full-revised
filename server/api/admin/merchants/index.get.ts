// server/api/admin/merchants/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const items = await prisma.merchantAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { code: true, name: true } },
      _count: { select: { paymentIntents: true, apiKeys: true, webhookEndpoints: true } },
    },
  })
  return { items }
})
