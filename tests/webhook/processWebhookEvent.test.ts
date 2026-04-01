import { beforeEach, describe, expect, it, mock } from "bun:test";

const prismaMock = {
  providerCallback: {
    findUnique: mock(),
    update: mock(),
  },
  paymentIntent: {
    findFirst: mock(),
    updateMany: mock(),
  },
};

const enqueueWebhookForPaymentMock = mock();

mock.module("~/server/lib/prisma", () => ({
  prisma: prismaMock,
}));

mock.module("~/server/services/webhooks/enqueueWebhookForPayment", () => ({
  enqueueWebhookForPayment: enqueueWebhookForPaymentMock,
}));

import { processWebhookEvent } from "~/server/services/webhooks/processWebhookEvent";

describe("processWebhookEvent", () => {
  beforeEach(() => {
    prismaMock.providerCallback.findUnique.mockReset();
    prismaMock.providerCallback.update.mockReset();
    prismaMock.paymentIntent.findFirst.mockReset();
    prismaMock.paymentIntent.updateMany.mockReset();
    enqueueWebhookForPaymentMock.mockReset();
  });

  it("skips already processed webhook", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_1",
      providerCode: "SCB",
      processStatus: "PROCESSED",
      body: { transactionId: "tx_scb_1" },
      processedAt: new Date(),
    });

    const result = await processWebhookEvent("wh_1");

    expect(result).toEqual({
      ok: true,
      provider: "scb",
      externalRef: null,
      reason: "already processed",
      skipped: true,
    });

    expect(prismaMock.providerCallback.update).not.toHaveBeenCalled();
    expect(prismaMock.paymentIntent.updateMany).not.toHaveBeenCalled();
    expect(enqueueWebhookForPaymentMock).not.toHaveBeenCalled();
  });

  it("marks webhook processed and updates payment on SCB success", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_2",
      providerCode: "SCB",
      processStatus: "RECEIVED",
      body: {
        transactionId: "tx_scb_1",
        status: "SUCCESS",
      },
      processedAt: null,
    });

    prismaMock.paymentIntent.findFirst.mockResolvedValue({
      id: "pi_1",
      tenantId: "t_1",
      merchantAccountId: "m_1",
      status: "AWAITING_CUSTOMER",
      publicId: "piq_1",
    });

    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_2" });
    enqueueWebhookForPaymentMock.mockResolvedValue(undefined);

    const result = await processWebhookEvent("wh_2");

    expect(result).toEqual({
      ok: true,
      provider: "scb",
      externalRef: null,
    });

    expect(prismaMock.providerCallback.update).toHaveBeenCalled();
  });

  it("marks webhook processed and skips when payment not found", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_3",
      providerCode: "KBANK",
      processStatus: "RECEIVED",
      body: {
        transactionId: "kb_ref_1",
        status: "SUCCESS",
      },
      processedAt: null,
    });

    prismaMock.paymentIntent.findFirst.mockResolvedValue(null);
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_3" });

    const result = await processWebhookEvent("wh_3");

    expect(result).toEqual({
      ok: true,
      provider: "kbank",
      externalRef: null,
    });

    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(2);

    const lastCall = prismaMock.providerCallback.update.mock.calls[1]?.[0];

    expect(lastCall).toEqual({
      where: { id: "wh_3" },
      data: expect.objectContaining({
        processStatus: "FAILED",
        errorMessage: "Payment intent not found for callback",
      }),
    });
  });

  it("fails unknown provider", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_4",
      providerCode: "UNKNOWN",
      processStatus: "RECEIVED",
      body: { foo: "bar" },
      processedAt: null,
    });

    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_4" });

    const result = await processWebhookEvent("wh_4");

    expect(result.ok).toBe(true);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(2);

    const lastCall = prismaMock.providerCallback.update.mock.calls[1]?.[0];

    expect(lastCall).toEqual({
      where: { id: "wh_4" },
      data: expect.objectContaining({
        processStatus: "FAILED",
        errorMessage: "Payment intent not found for callback",
      }),
    });
  });
});