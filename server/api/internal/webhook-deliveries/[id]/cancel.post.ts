import { createError, defineEventHandler } from "h3"
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "").trim()

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing webhook delivery id" })
  }

  const delivery = await prisma.webhookDelivery.findUnique({ where: { id } })

  if (!delivery) {
    throw createError({ statusCode: 404, statusMessage: "Webhook delivery not found" })
  }

  if (!["PENDING", "RETRYING"].includes(delivery.status)) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot cancel delivery in status: ${delivery.status}`,
    })
  }

  await prisma.webhookDelivery.update({
    where: { id },
    data: {
      status: "DEAD",
      nextAttemptAt: null,
      errorMessage: "Cancelled by admin",
      lastErrorAt: new Date(),
    },
  })

  return { ok: true, id, previousStatus: delivery.status }
})
