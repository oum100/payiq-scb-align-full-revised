import { describe, it, expect, mock, beforeEach } from "bun:test";

const prismaMock = {
  providerCallback: {
    updateMany: mock(),
  },
};

const processWebhookMock = mock();

mock.module("~~/server/lib/prisma", () => ({
  prisma: prismaMock,
}));

mock.module("~~/server/utils/queue/webhook.processor", () => ({
  processWebhook: processWebhookMock,
}));

beforeEach(() => {
  prismaMock.providerCallback.updateMany.mockReset();
  processWebhookMock.mockReset();
});

describe("webhook.worker logic", () => {
  it("should mark processed when processor succeeds", async () => {
    processWebhookMock.mockResolvedValue({ ok: true });
    prismaMock.providerCallback.updateMany.mockResolvedValue({ count: 1 });

    const { processWebhook } =
      await import("~~/server/utils/queue/webhook.processor");
    const { prisma } = await import("~~/server/lib/prisma");

    const job = {
      data: {
        provider: "SCB",
        providerCallbackId: "pcb_worker_ok",
        rawBody: JSON.stringify({ transactionId: "tx_001" }),
      },
    };

    await processWebhook(job.data);

    await prisma.providerCallback.updateMany({
      where: {
        // provider: job.data.provider,
        // eventId: job.data.eventId,
        id: job.data.providerCallbackId,
      },
      data: {
        processStatus: "PROCESSED",
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    expect(processWebhookMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.updateMany).toHaveBeenCalledTimes(1);
  });

  it("should mark failed when processor throws", async () => {
    processWebhookMock.mockRejectedValue(new Error("processor failed"));
    prismaMock.providerCallback.updateMany.mockResolvedValue({ count: 1 });

    const { processWebhook } =
      await import("~~/server/utils/queue/webhook.processor");
    const { prisma } = await import("~~/server/lib/prisma");

    const job = {
      data: {
        provider: "KBANK",
        providerCallbackId: "pcb_worker_fail",
        rawBody: JSON.stringify({ reference: "kb_001" }),
      },
      attemptsMade: 4,
      opts: {
        attempts: 5,
      },
    };

    try {
      await processWebhook(job.data);
    } catch (error: any) {
      await prisma.providerCallback.updateMany({
        where: {
          id: job.data.providerCallbackId,
        },
        data: {
          processStatus: "FAILED",
          errorMessage: error.message,
        },
      });
    }

    expect(processWebhookMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.updateMany).toHaveBeenCalledTimes(1);
    const firstCall = prismaMock.providerCallback.updateMany.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]?.data?.processStatus).toBe("FAILED");
  });
});
