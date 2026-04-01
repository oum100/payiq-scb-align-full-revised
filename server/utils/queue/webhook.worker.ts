import { Worker } from "bullmq";
import { redis } from "~/server/lib/redis";
import { queueNames } from "~/server/lib/bullmq";
import { processWebhook } from "~/server/utils/queue/webhook.processor";
import { prisma } from "~/server/lib/prisma";

new Worker(
  queueNames.webhookInbound,
  async (job) => {
    const data = job.data as { provider: string; eventId?: string; rawBody: string; providerCallbackId?: string };
    try {
      await processWebhook(data);
      if (data.providerCallbackId) {
        await prisma.providerCallback.updateMany({
          where: { id: data.providerCallbackId },
          data: { processStatus: "PROCESSED", processedAt: new Date(), errorMessage: null },
        });
      }
    } catch (error: any) {
      if (data.providerCallbackId) {
        await prisma.providerCallback.updateMany({
          where: { id: data.providerCallbackId },
          data: { processStatus: "FAILED", errorMessage: error.message, failedAt: new Date() },
        });
      }
      throw error;
    }
  },
  { connection: redis, concurrency: 10 },
);
