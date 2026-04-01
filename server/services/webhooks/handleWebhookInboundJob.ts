import { prisma } from "~/server/lib/prisma";
import { processWebhookEvent } from "~/server/services/webhooks/processWebhookEvent";
import { NonRetryableJobError } from "~/server/tasks/job-errors";

type WebhookInboundJob = {
  data: {
    webhookEventId?: string;
    providerCallbackId?: string;
  };
  attemptsMade: number;
  opts?: {
    attempts?: number;
  };
};

type DlqLike = {
  add: (name: string, data: Record<string, any>, opts?: Record<string, any>) => Promise<any>;
};

function toSafeDlqJobId(providerCallbackId: string) {
  return `dlq__webhook__${providerCallbackId}`;
}

export async function handleWebhookInboundJob(job: WebhookInboundJob, dlq?: DlqLike) {
  const providerCallbackId = job.data?.providerCallbackId ?? job.data?.webhookEventId;
  if (!providerCallbackId) {
    throw new NonRetryableJobError("Missing providerCallbackId in job payload", "MISSING_PROVIDER_CALLBACK_ID");
  }

  const existing = await prisma.providerCallback.findUnique({ where: { id: providerCallbackId }, select: { id: true } });
  if (!existing) {
    throw new NonRetryableJobError(`Provider callback not found: ${providerCallbackId}`, "PROVIDER_CALLBACK_NOT_FOUND");
  }

  try {
    return await processWebhookEvent(providerCallbackId);
  } catch (error: any) {
    const attempts = job.attemptsMade + 1;
    const maxAttempts = job.opts?.attempts ?? 1;
    const isFinalAttempt = attempts >= maxAttempts;
    const message = error?.message || "unknown error";

    await prisma.providerCallback.update({
      where: { id: providerCallbackId },
      data: {
        processStatus: isFinalAttempt ? "FAILED" : "RECEIVED",
        errorMessage: message,
      },
    });

    if (isFinalAttempt && dlq) {
      await dlq.add(
        "provider.webhook.dlq",
        {
          providerCallbackId,
          failedAt: new Date().toISOString(),
          reason: message,
        },
        {
          jobId: toSafeDlqJobId(providerCallbackId),
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }

    throw error;
  }
}
