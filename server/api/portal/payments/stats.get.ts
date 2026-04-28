import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const tenantId = user.tenantId

  const [total, succeeded, pending, failed] = await Promise.all([
    prisma.paymentIntent.count({ where: { tenantId } }),
    prisma.paymentIntent.count({ where: { tenantId, status: "SUCCEEDED" } }),
    prisma.paymentIntent.count({
      where: { tenantId, status: { in: ["CREATED", "ROUTING", "PENDING_PROVIDER", "AWAITING_CUSTOMER", "PROCESSING"] } },
    }),
    prisma.paymentIntent.count({
      where: { tenantId, status: { in: ["FAILED", "EXPIRED", "CANCELLED", "REVERSED", "REFUNDED"] } },
    }),
  ])

  return { total, succeeded, pending, failed }
})
