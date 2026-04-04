import { createError, defineEventHandler } from "h3";
import { Prisma } from "@prisma/client";
import { prisma } from "~/server/lib/prisma";
import { webhookQueue } from "~/server/lib/bullmq";

export default defineEventHandler(async (event) => {
  const id = String(event.context.params?.id || "").trim();

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing webhook delivery id",
    });
  }

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id },
    include: {
      webhookEndpoint: {
        select: {
          maxAttempts: true,
        },
      },
    },
  });

  if (!delivery) {
    throw createError({
      statusCode: 404,
      statusMessage: "Webhook delivery not found",
    });
  }

  if (delivery.status === "PROCESSING") {
    throw createError({
      statusCode: 409,
      statusMessage: "Webhook delivery is currently processing",
    });
  }

  const resetAttemptNumber =
    delivery.status === "DEAD" ? 0 : delivery.attemptNumber;

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "RETRYING",
      nextAttemptAt: new Date(),
      lastErrorAt: null,
      errorMessage: null,
      responseStatusCode: null,
      responseHeaders: null,
      responseBody: null,
      deliveredAt: null,
      attemptNumber: resetAttemptNumber,
    },
  });

  await webhookQueue.add(
    "merchant.webhook.deliver",
    { webhookDeliveryId: delivery.id },
    {
      jobId: `redrive__${delivery.id}__${Date.now()}`,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  );

  return {
    ok: true,
    id: delivery.id,
    previousStatus: delivery.status,
    resetAttemptNumber,
    enqueued: true,
  };
});