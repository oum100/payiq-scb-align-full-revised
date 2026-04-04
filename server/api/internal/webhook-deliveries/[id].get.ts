import { createError, defineEventHandler } from "h3";
import { prisma } from "~~/server/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "").trim();

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing webhook delivery id",
    });
  }

  const item = await prisma.webhookDelivery.findUnique({
    where: { id },
    include: {
      paymentIntent: {
        include: {
          events: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      webhookEndpoint: true,
    },
  });

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: "Webhook delivery not found",
    });
  }

  return {
    item,
  };
});