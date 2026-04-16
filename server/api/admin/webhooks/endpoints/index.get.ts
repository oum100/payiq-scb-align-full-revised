import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const items = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      merchantAccount: { select: { id: true, code: true, name: true } },
      _count: { select: { deliveries: true } },
    },
  })

  return {
    items: items.map((e) => ({
      id: e.id,
      code: e.code,
      url: e.url,
      status: e.status,
      maxAttempts: e.maxAttempts,
      timeoutMs: e.timeoutMs,
      subscribedEvents: e.subscribedEvents,
      tenant: e.tenant,
      merchant: e.merchantAccount,
      deliveryCount: e._count.deliveries,
      createdAt: e.createdAt.toISOString(),
    })),
  }
})
