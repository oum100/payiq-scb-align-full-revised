import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const q = getQuery(event)
  const page     = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
  const status   = typeof q.status === "string" && q.status ? q.status : undefined

  const where: any = { paymentIntent: { tenantId: user.tenantId } }
  if (status) where.status = status

  const [total, items] = await Promise.all([
    prisma.webhookDelivery.count({ where }),
    prisma.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        eventType: true,
        attemptNumber: true,
        responseStatusCode: true,
        targetUrlSnapshot: true,
        deliveredAt: true,
        createdAt: true,
        errorMessage: true,
        paymentIntent: { select: { publicId: true, amount: true, currency: true } },
      },
    }),
  ])

  return {
    items: items.map((d) => ({
      ...d,
      paymentIntent: {
        ...d.paymentIntent,
        amount: d.paymentIntent.amount.toString(),
      },
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
})
