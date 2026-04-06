// server/api/admin/payments/[publicId].get.ts
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"

export default defineEventHandler(async (event) => {
  const publicId = getRouterParam(event, "publicId")!

  const payment = await prisma.paymentIntent.findFirst({
    where: { publicId },
    include: {
      merchantAccount: { select: { code: true, name: true, environment: true } },
      events: { orderBy: { createdAt: "asc" } },
      providerAttempts: { orderBy: { createdAt: "desc" }, take: 10 },
      providerCallbacks: { orderBy: { receivedAt: "desc" }, take: 10 },
      webhookDeliveries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { webhookEndpoint: { select: { code: true, url: true } } },
      },
    },
  })

  if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404)

  return {
    ...payment,
    amount: payment.amount.toString(),
    feeAmount: payment.feeAmount.toString(),
    netAmount: payment.netAmount.toString(),
  }
})
