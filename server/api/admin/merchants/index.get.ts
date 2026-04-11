// server/api/admin/merchants/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const raw = await prisma.merchantAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      _count: { select: { paymentIntents: true, apiKeys: true, webhookEndpoints: true } },
    },
  })
  // expose tenantId at top level for easy filtering in frontend
  const items = raw.map(m => ({ ...m, tenantId: m.tenantId }))
  return { items }
})
