import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const prismaMock = {
  providerCallback: {
    findUnique: mock(),
    update: mock(),
  },
};

const processWebhookEventMock = mock();

mock.module("~~/server/lib/prisma", () => ({
  prisma: prismaMock,
}));

mock.module("~~/server/services/webhooks/processWebhookEvent", () => ({
  processWebhookEvent: processWebhookEventMock,
}));

const { handleWebhookInboundJob } =
  await import("~~/server/services/webhooks/handleWebhookInboundJob");
const { NonRetryableJobError } = await import("~~/server/tasks/job-errors");

beforeEach(() => {
  prismaMock.providerCallback.findUnique.mockReset();
  prismaMock.providerCallback.update.mockReset();
  processWebhookEventMock.mockReset();
});

describe("handleWebhookInboundJob", () => {
  it("throws NonRetryableJobError when providerCallbackId is missing", async () => {
    const dlq = {
      add: mock(),
    };

    await expect(
      handleWebhookInboundJob(
        {
          data: {} as any,
          attemptsMade: 0,
          opts: { attempts: 5 },
        },
        dlq,
      ),
    ).rejects.toMatchObject({
      name: "NonRetryableJobError",
      code: "MISSING_PROVIDER_CALLBACK_ID",
    });

    expect(prismaMock.providerCallback.findUnique).toHaveBeenCalledTimes(0);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(0);
    expect(processWebhookEventMock).toHaveBeenCalledTimes(0);
    expect(dlq.add).toHaveBeenCalledTimes(0);
  });

  it("throws NonRetryableJobError when webhook event does not exist", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue(null);

    const dlq = {
      add: mock(),
    };

    await expect(
      handleWebhookInboundJob(
        {
          data: { providerCallbackId: "evt_missing" },
          attemptsMade: 0,
          opts: { attempts: 5 },
        },
        dlq,
      ),
    ).rejects.toMatchObject({
      name: "NonRetryableJobError",
      code: "PROVIDER_CALLBACK_NOT_FOUND",
      message: "Provider callback not found: evt_missing",
    });

    expect(prismaMock.providerCallback.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.findUnique).toHaveBeenCalledWith({
      where: { id: "evt_missing" },
      select: { id: true },
    });
    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(0);
    expect(processWebhookEventMock).toHaveBeenCalledTimes(0);
    expect(dlq.add).toHaveBeenCalledTimes(0);
  });

  it("passes through when processor succeeds", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({ id: "wh_ok_1" });
    processWebhookEventMock.mockResolvedValue({ ok: true });

    const dlq = {
      add: mock(),
    };

    const result = await handleWebhookInboundJob(
      {
        data: { providerCallbackId: "wh_ok_1" },
        attemptsMade: 0,
        opts: { attempts: 5 },
      },
      dlq,
    );

    expect(result).toMatchObject({ ok: true });
    expect(prismaMock.providerCallback.findUnique).toHaveBeenCalledTimes(1);
    expect(processWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(processWebhookEventMock).toHaveBeenCalledWith("wh_ok_1");
    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(0);
    expect(dlq.add).toHaveBeenCalledTimes(0);
  });

  it("marks VERIFIED and throws for retry on non-final attempt", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_retry_1",
    });
    processWebhookEventMock.mockRejectedValue(new Error("temporary failure"));
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_retry_1" });

    const dlq = {
      add: mock(),
    };

    await expect(
      handleWebhookInboundJob(
        {
          data: { providerCallbackId: "wh_retry_1" },
          attemptsMade: 1,
          opts: { attempts: 5 },
        },
        dlq,
      ),
    ).rejects.toThrow("temporary failure");

    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledWith({
      where: { id: "wh_retry_1" },
      data: {
        processStatus: "RECEIVED",
        errorMessage: "temporary failure",
      },
    });
    expect(dlq.add).toHaveBeenCalledTimes(0);
  });

  it("marks FAILED and sends to DLQ on final attempt", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_fail_1",
    });
    processWebhookEventMock.mockRejectedValue(new Error("permanent failure"));
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_fail_1" });

    const dlq = {
      add: mock().mockResolvedValue({}),
    };

    await expect(
      handleWebhookInboundJob(
        {
          data: { providerCallbackId: "wh_fail_1" },
          attemptsMade: 4,
          opts: { attempts: 5 },
        },
        dlq,
      ),
    ).rejects.toThrow("permanent failure");

    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledWith({
      where: { id: "wh_fail_1" },
      data: {
        processStatus: "FAILED",
        errorMessage: "permanent failure",
      },
    });

    expect(dlq.add).toHaveBeenCalledTimes(1);
    expect(dlq.add).toHaveBeenCalledWith(
      "provider.webhook.dlq",
      expect.objectContaining({
        providerCallbackId: "wh_fail_1",
        reason: "permanent failure",
      }),
      expect.objectContaining({
        jobId: "dlq__webhook__wh_fail_1",
        removeOnComplete: 1000,
        removeOnFail: 1000,
      }),
    );
  });

  it("uses default attempts=1 and goes DLQ immediately", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_fail_2",
    });
    processWebhookEventMock.mockRejectedValue(new Error("boom"));
    prismaMock.providerCallback.update.mockResolvedValue({ id: "wh_fail_2" });

    const dlq = {
      add: mock().mockResolvedValue({}),
    };

    await expect(
      handleWebhookInboundJob(
        {
          data: { providerCallbackId: "wh_fail_2" },
          attemptsMade: 0,
        },
        dlq,
      ),
    ).rejects.toThrow("boom");

    expect(prismaMock.providerCallback.update).toHaveBeenCalledWith({
      where: { id: "wh_fail_2" },
      data: {
        processStatus: "FAILED",
        errorMessage: "boom",
      },
    });
    expect(dlq.add).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit NonRetryableJobError from downstream processor", async () => {
    prismaMock.providerCallback.findUnique.mockResolvedValue({
      id: "wh_nonretryable_1",
    });
    processWebhookEventMock.mockRejectedValue(
      new NonRetryableJobError("bad payload", "BAD_WEBHOOK_PAYLOAD"),
    );
    prismaMock.providerCallback.update.mockResolvedValue({
      id: "wh_nonretryable_1",
    });

    await expect(
      handleWebhookInboundJob({
        data: { providerCallbackId: "wh_nonretryable_1" },
        attemptsMade: 0,
        opts: { attempts: 5 },
      }),
    ).rejects.toMatchObject({
      name: "NonRetryableJobError",
      code: "BAD_WEBHOOK_PAYLOAD",
      message: "bad payload",
    });

    expect(prismaMock.providerCallback.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.providerCallback.update).toHaveBeenCalledWith({
      where: { id: "wh_nonretryable_1" },
      data: {
        processStatus: "RECEIVED",
        errorMessage: "bad payload",
      },
    });
  });
});

afterAll(() => {
  mock.restore();
});
