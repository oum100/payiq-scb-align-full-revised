import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const prismaMock: any = {
  providerCallback: {
    findUnique: mock(),
    update: mock(),
  },
  paymentIntent: {
    findFirst: mock(),
    findUnique: mock(),
    updateMany: mock(),
  },
  paymentEvent: {
    create: mock(),
  },
};

prismaMock.$transaction = mock(
  async (fn: (tx: typeof prismaMock) => unknown) => {
    return await fn(prismaMock);
  },
);

mock.module("~/server/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { processWebhookEvent } =
  await import("~/server/services/webhooks/processWebhookEvent");

beforeEach(() => {
  prismaMock.providerCallback.findUnique.mockReset();
  prismaMock.providerCallback.update.mockReset();
  prismaMock.paymentIntent.findFirst.mockReset();
  prismaMock.paymentIntent.findUnique.mockReset();
  prismaMock.paymentIntent.updateMany.mockReset();
  prismaMock.paymentEvent.create.mockReset();
  prismaMock.$transaction.mockReset();

  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => unknown) => {
      return await fn(prismaMock);
    },
  );
});

afterAll(() => {
  mock.restore();
});

describe("processWebhookEvent", () => {
  it("processes scb webhook event", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_1",
      providerCode: "SCB",
      eventId: "evt_1",
      body: {
        transactionId: "tx_scb_1",
        eventType: "payment.success",
      },
      processStatus: "RECEIVED",
      processedAt: null,
    });

    prismaMock.paymentIntent.findFirst.mockResolvedValue({
      id: "pi_1",
      publicId: "piq_1",
      providerReference: "tx_scb_1",
      providerTransactionId: "tx_scb_1",
      status: "AWAITING_CUSTOMER",
    });

    prismaMock.paymentIntent.findUnique
      .mockResolvedValueOnce({
        id: "pi_1",
        status: "AWAITING_CUSTOMER",
      })
      .mockResolvedValueOnce({
        id: "pi_1",
        publicId: "piq_1",
        status: "SUCCEEDED",
        amount: { toString: () => "100.00" },
        currency: "THB",
        qrPayload: null,
        deeplinkUrl: null,
        redirectUrl: null,
        expiresAt: null,
      });

    prismaMock.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.paymentEvent.create.mockResolvedValue({});
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_1" });

    const result = await processWebhookEvent("wh_1");

    expect(result.ok).toBe(true);
    expect(!("skipped" in result) && result.provider).toBe("scb");
    expect(!("skipped" in result) && result.externalRef).toBeNull();
  });

  it("processes kbank webhook event", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_2",
      providerCode: "KBANK",
      eventId: "evt_2",
      body: {
        reference: "kb_ref_1",
        status: "SUCCESS",
      },
      processStatus: "RECEIVED",
      processedAt: null,
    });

    prismaMock.paymentIntent.findFirst.mockResolvedValue({
      id: "pi_2",
      publicId: "piq_2",
      providerReference: "kb_ref_1",
      providerTransactionId: null,
      status: "AWAITING_CUSTOMER",
    });

    prismaMock.paymentIntent.findUnique
      .mockResolvedValueOnce({
        id: "pi_2",
        status: "AWAITING_CUSTOMER",
      })
      .mockResolvedValueOnce({
        id: "pi_2",
        publicId: "piq_2",
        status: "SUCCEEDED",
        amount: { toString: () => "100.00" },
        currency: "THB",
        qrPayload: null,
        deeplinkUrl: null,
        redirectUrl: null,
        expiresAt: null,
      });

    prismaMock.paymentIntent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.paymentEvent.create.mockResolvedValue({});
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_2" });

    const result = await processWebhookEvent("wh_2");

    expect(result.ok).toBe(true);
    expect(!("skipped" in result) && result.provider).toBe("kbank");
    expect(!("skipped" in result) && result.externalRef).toBeNull();
  });

  it("skips already processed event", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_3",
      providerCode: "SCB",
      eventId: "evt_3",
      body: { transactionId: "tx_3" },
      processStatus: "PROCESSED",
      processedAt: new Date(),
    });

    const result = await processWebhookEvent("wh_3");

    expect(result.ok).toBe(true);
    expect("skipped" in result && result.skipped).toBe(true);
  });

  it("fails on invalid json", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_4",
      providerCode: "SCB",
      eventId: "evt_4",
      body: { _raw: "{bad json}", _invalidJson: true },
      processStatus: "RECEIVED",
      processedAt: null,
    });

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

  it("fails on unknown provider", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_5",
      providerCode: "UNKNOWN",
      eventId: "evt_5",
      body: { ok: true },
      processStatus: "RECEIVED",
      processedAt: null,
    });

    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_5" });

    const result = await processWebhookEvent("wh_5");

    expect(result.ok).toBe(true);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(2);

    const lastCall = prismaMock.providerCallback.update.mock.calls[1]?.[0];

    expect(lastCall).toEqual({
      where: { id: "wh_5" },
      data: expect.objectContaining({
        processStatus: "FAILED",
        errorMessage: "Payment intent not found for callback",
      }),
    });
  });

  it("fails when event not found", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue(null);

    await expect(processWebhookEvent("wh_missing")).rejects.toThrow(
      "provider callback not found",
    );
  });
});
