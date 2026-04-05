import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { callbackQueue, queueNames } from "~~/server/lib/bullmq";
import { redis } from "~~/server/lib/redis";

function makeDecimal(value: string) {
  return {
    toString() {
      return value;
    },
  };
}

type DecimalLike = {
  toString(): string;
};

type PaymentRecord = {
  id: string;
  publicId: string;
  tenantId: string;
  merchantAccountId: string;
  paymentRouteId: string;
  billerProfileId: string;
  merchantOrderId: string | null;
  merchantReference: string | null;
  providerCode: string;
  providerReference: string | null;
  providerTransactionId: string | null;
  currency: string;
  amount: DecimalLike;
  status: string;
  qrPayload: string | null;
  deeplinkUrl: string | null;
  redirectUrl: string | null;
  expiresAt: Date | null;
  succeededAt: Date | null;
  failedAt: Date | null;
  expiredAt: Date | null;
};

type ProviderCallbackRecord = {
  id: string;
  paymentIntentId: string | null;
  processStatus: string;
  signatureValid: boolean | null;
  providerReference: string | null;
  providerTxnId: string | null;
  body: unknown;
  errorMessage: string | null;
  processedAt: Date | null;
  failedAt: Date | null;
};

type PaymentWhere = Record<string, unknown>;

function clonePaymentRecord(
  payment: PaymentRecord | null,
): PaymentRecord | null {
  if (!payment) {
    return null;
  }

  return {
    ...payment,
    amount: makeDecimal(payment.amount.toString()),
  };
}

function cloneProviderCallbackRecord(
  callback: ProviderCallbackRecord | null,
): ProviderCallbackRecord | null {
  if (!callback) {
    return null;
  }

  return {
    ...callback,
  };
}

async function waitForWorkerOutcome(
  worker: Worker,
  timeoutMs = 12000,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Worker outcome not observed within ${timeoutMs}ms`));
    }, timeoutMs);

    const onCompleted = () => {
      cleanup();
      resolve();
    };

    const onFailed = (_job: Job | undefined, error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
    };

    worker.on("completed", onCompleted);
    worker.on("failed", onFailed);
  });
}

describe("SCB runtime flow e2e", () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalScbCallbackSecret = process.env.SCB_CALLBACK_SECRET;

  let worker: Worker | null;
  let paymentRecord: PaymentRecord;
  let providerCallbackRecord: ProviderCallbackRecord | null;
  let paymentExists: boolean;

  beforeEach(async () => {
    process.env.APP_BASE_URL = "https://payiq.example.com";
    process.env.SCB_CALLBACK_SECRET = "secret_scb_test";

    paymentExists = false;
    worker = null;

    paymentRecord = {
      id: "pi_rt_001",
      publicId: "piq_rt_001",
      tenantId: "tenant_001",
      merchantAccountId: "ma_001",
      paymentRouteId: "route_001",
      billerProfileId: "bp_001",
      merchantOrderId: null,
      merchantReference: null,
      providerCode: "SCB",
      providerReference: null,
      providerTransactionId: null,
      currency: "THB",
      amount: makeDecimal("20.00"),
      status: "CREATED",
      qrPayload: null,
      deeplinkUrl: null,
      redirectUrl: null,
      expiresAt: new Date("2026-03-22T18:15:00.000Z"),
      succeededAt: null,
      failedAt: null,
      expiredAt: null,
    };

    providerCallbackRecord = null;

    (globalThis as Record<string, unknown>).defineEventHandler = (
      fn: unknown,
    ) => fn;
    (globalThis as Record<string, unknown>).readRawBody = async (event: {
      rawBody?: string;
    }) => event.rawBody || "";
    (globalThis as Record<string, unknown>).getHeaders = (event: {
      headers?: Record<string, string>;
    }) => event.headers || {};
    (globalThis as Record<string, unknown>).getQuery = (event: {
      query?: Record<string, string>;
    }) => event.query || {};
    (globalThis as Record<string, unknown>).getHeader = (
      event: { headers?: Record<string, string> },
      name: string,
    ) => {
      const headers = event.headers || {};
      return (
        headers[name] ??
        headers[name.toLowerCase()] ??
        headers[name.toUpperCase()]
      );
    };

    await callbackQueue.obliterate({ force: true });
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
    }

    await callbackQueue.obliterate({ force: true }).catch(() => undefined);

    mock.restore();

    delete (globalThis as Record<string, unknown>).defineEventHandler;
    delete (globalThis as Record<string, unknown>).readRawBody;
    delete (globalThis as Record<string, unknown>).getHeaders;
    delete (globalThis as Record<string, unknown>).getQuery;
    delete (globalThis as Record<string, unknown>).getHeader;

    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }

    if (originalScbCallbackSecret === undefined) {
      delete process.env.SCB_CALLBACK_SECRET;
    } else {
      process.env.SCB_CALLBACK_SECRET = originalScbCallbackSecret;
    }
  });

  test("create payment -> callback ingress -> real queue worker -> payment succeeded", async () => {
    const providerAttempts: Array<Record<string, unknown>> = [];
    const webhookJobs: Array<Record<string, unknown>> = [];

    const getPaymentSnapshot = async (): Promise<PaymentRecord | null> => {
      return paymentExists ? clonePaymentRecord(paymentRecord) : null;
    };

    const getProviderCallbackSnapshot =
      async (): Promise<ProviderCallbackRecord | null> => {
        return cloneProviderCallbackRecord(providerCallbackRecord);
      };

    const matchPaymentFromWhere = (
      where?: PaymentWhere,
    ): PaymentRecord | null => {
      if (!paymentExists || !where || typeof where !== "object") {
        return null;
      }

      const merchantOrderId = where.merchantOrderId;
      if (
        typeof merchantOrderId === "string" &&
        merchantOrderId === paymentRecord.merchantOrderId
      ) {
        return clonePaymentRecord(paymentRecord);
      }

      const orList = Array.isArray(where.OR)
        ? (where.OR as Array<Record<string, unknown>>)
        : [];

      for (const condition of orList) {
        if (
          typeof condition.providerTransactionId === "string" &&
          condition.providerTransactionId ===
            paymentRecord.providerTransactionId
        ) {
          return clonePaymentRecord(paymentRecord);
        }

        if (
          typeof condition.publicId === "string" &&
          condition.publicId === paymentRecord.publicId
        ) {
          return clonePaymentRecord(paymentRecord);
        }

        if (
          typeof condition.providerReference === "string" &&
          condition.providerReference === paymentRecord.providerReference
        ) {
          return clonePaymentRecord(paymentRecord);
        }
      }

      return null;
    };

    const applyPaymentPatch = (patch: Record<string, unknown>) => {
      paymentRecord = {
        ...paymentRecord,
        status:
          typeof patch.status === "string"
            ? patch.status
            : paymentRecord.status,
        providerReference:
          "providerReference" in patch
            ? ((patch.providerReference as string | null | undefined) ?? null)
            : paymentRecord.providerReference,
        providerTransactionId:
          "providerTransactionId" in patch
            ? ((patch.providerTransactionId as string | null | undefined) ??
              null)
            : paymentRecord.providerTransactionId,
        qrPayload:
          "qrPayload" in patch
            ? ((patch.qrPayload as string | null | undefined) ?? null)
            : paymentRecord.qrPayload,
        deeplinkUrl:
          "deeplinkUrl" in patch
            ? ((patch.deeplinkUrl as string | null | undefined) ?? null)
            : paymentRecord.deeplinkUrl,
        redirectUrl:
          "redirectUrl" in patch
            ? ((patch.redirectUrl as string | null | undefined) ?? null)
            : paymentRecord.redirectUrl,
        succeededAt:
          "succeededAt" in patch
            ? ((patch.succeededAt as Date | null | undefined) ?? null)
            : paymentRecord.succeededAt,
        failedAt:
          "failedAt" in patch
            ? ((patch.failedAt as Date | null | undefined) ?? null)
            : paymentRecord.failedAt,
        expiredAt:
          "expiredAt" in patch
            ? ((patch.expiredAt as Date | null | undefined) ?? null)
            : paymentRecord.expiredAt,
      };
    };

    const applyProviderCallbackPatch = (patch: Record<string, unknown>) => {
      if (!providerCallbackRecord) {
        throw new Error("providerCallbackRecord missing");
      }

      providerCallbackRecord = {
        ...providerCallbackRecord,
        paymentIntentId:
          "paymentIntentId" in patch
            ? ((patch.paymentIntentId as string | null | undefined) ?? null)
            : providerCallbackRecord.paymentIntentId,
        processStatus:
          typeof patch.processStatus === "string"
            ? patch.processStatus
            : providerCallbackRecord.processStatus,
        errorMessage:
          "errorMessage" in patch
            ? ((patch.errorMessage as string | null | undefined) ?? null)
            : providerCallbackRecord.errorMessage,
        processedAt:
          "processedAt" in patch
            ? ((patch.processedAt as Date | null | undefined) ?? null)
            : providerCallbackRecord.processedAt,
        failedAt:
          "failedAt" in patch
            ? ((patch.failedAt as Date | null | undefined) ?? null)
            : providerCallbackRecord.failedAt,
      };
    };

    mock.module("~/server/lib/prisma", () => ({
      prisma: {
        merchantAccount: {
          findFirst: mock(async () => ({
            id: "ma_001",
            tenantId: "tenant_001",
            status: "ACTIVE",
          })),
        },

        paymentIntent: {
          findFirst: mock(async (args?: { where?: PaymentWhere }) => {
            return matchPaymentFromWhere(args?.where);
          }),

          create: mock(async (args: { data: Record<string, unknown> }) => {
            paymentExists = true;

            paymentRecord = {
              ...paymentRecord,
              tenantId: String(args.data.tenantId),
              merchantAccountId: String(args.data.merchantAccountId),
              paymentRouteId: String(args.data.paymentRouteId),
              billerProfileId: String(args.data.billerProfileId),
              merchantOrderId:
                typeof args.data.merchantOrderId === "string"
                  ? args.data.merchantOrderId
                  : null,
              merchantReference:
                typeof args.data.merchantReference === "string"
                  ? args.data.merchantReference
                  : null,
              providerCode: String(args.data.providerCode),
              currency: String(args.data.currency),
              amount: makeDecimal(String(args.data.amount)),
              status: String(args.data.status),
              qrPayload: null,
              deeplinkUrl: null,
              redirectUrl: null,
              expiresAt:
                args.data.expiresAt instanceof Date
                  ? args.data.expiresAt
                  : null,
              providerReference: null,
              providerTransactionId: null,
              succeededAt: null,
              failedAt: null,
              expiredAt: null,
            };

            return {
              id: paymentRecord.id,
              publicId: paymentRecord.publicId,
              amount: paymentRecord.amount,
              currency: paymentRecord.currency,
              merchantOrderId: paymentRecord.merchantOrderId,
              expiresAt: paymentRecord.expiresAt,
            };
          }),

          findUnique: mock(async () => getPaymentSnapshot()),

          update: mock(async (args: { data: Record<string, unknown> }) => {
            applyPaymentPatch(args.data);
            return (await getPaymentSnapshot())!;
          }),

          updateMany: mock(async (args: { data: Record<string, unknown> }) => {
            applyPaymentPatch(args.data);
            return { count: 1 };
          }),
        },

        paymentEvent: {
          create: mock(async () => ({ id: "pe_001" })),
        },

        providerAttempt: {
          create: mock(async (args: { data: Record<string, unknown> }) => {
            providerAttempts.push(args.data);
            return { id: "pa_001" };
          }),
        },

        providerCallback: {
          create: mock(async (args: { data: Record<string, unknown> }) => {
            providerCallbackRecord = {
              id: "pcb_rt_001",
              paymentIntentId: null,
              processStatus: String(args.data.processStatus),
              signatureValid:
                typeof args.data.signatureValid === "boolean"
                  ? args.data.signatureValid
                  : null,
              providerReference:
                typeof args.data.providerReference === "string"
                  ? args.data.providerReference
                  : null,
              providerTxnId:
                typeof args.data.providerTxnId === "string"
                  ? args.data.providerTxnId
                  : null,
              body: {
                ...(args.data.body as Record<string, unknown>),
                _normalized: {
                  providerReference: paymentRecord.publicId,
                  providerTxnId: "scb-rt-txn-001",
                  normalizedStatus: "SUCCEEDED",
                  externalStatus: "SUCCESS",
                  eventId: "scb-rt-txn-001",
                },
              },
              errorMessage: null,
              processedAt: null,
              failedAt: null,
            };

            return { id: "pcb_rt_001" };
          }),

          update: mock(async (args: { data: Record<string, unknown> }) => {
            applyProviderCallbackPatch(args.data);
            return { id: "pcb_rt_001" };
          }),

          findUnique: mock(async () => getProviderCallbackSnapshot()),
        },

        webhookEndpoint: {
          findMany: mock(async () => [
            {
              id: "we_001",
              tenantId: "tenant_001",
              status: "ACTIVE",
            },
          ]),
        },

        webhookDelivery: {
          create: mock(async () => ({ id: "wd_001" })),
        },

        $transaction: async <T>(
          fn: (tx: {
            paymentIntent: {
              findUnique: (args: unknown) => Promise<PaymentRecord | null>;
              findFirst: (args: unknown) => Promise<PaymentRecord | null>;
              update: (args: unknown) => Promise<PaymentRecord>;
              updateMany: (args: unknown) => Promise<{ count: number }>;
            };
            paymentEvent: {
              create: (args: unknown) => Promise<{ id: string }>;
            };
            providerCallback: {
              findUnique: (
                args: unknown,
              ) => Promise<ProviderCallbackRecord | null>;
              update: (args: unknown) => Promise<{ id: string }>;
            };
          }) => Promise<T>,
        ) => {
          return fn({
            paymentIntent: {
              findUnique: async () => getPaymentSnapshot(),
              findFirst: async (args: unknown) => {
                const typedArgs = args as { where?: PaymentWhere };
                return matchPaymentFromWhere(typedArgs?.where);
              },
              update: async (args: unknown) => {
                const typedArgs = args as { data: Record<string, unknown> };
                applyPaymentPatch(typedArgs.data);
                return (await getPaymentSnapshot())!;
              },
              updateMany: async (args: unknown) => {
                const typedArgs = args as { data: Record<string, unknown> };
                applyPaymentPatch(typedArgs.data);
                return { count: 1 };
              },
            },
            paymentEvent: {
              create: async () => ({ id: "pe_001" }),
            },
            providerCallback: {
              findUnique: async () => getProviderCallbackSnapshot(),
              update: async (args: unknown) => {
                const typedArgs = args as { data: Record<string, unknown> };
                applyProviderCallbackPatch(typedArgs.data);
                return { id: "pcb_rt_001" };
              },
            },
          });
        },
      },
    }));

    class FakeAppError extends Error {
      code: string;
      statusCode: number;

      constructor(code: string, message: string, statusCode: number) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
      }
    }

    mock.module("~/server/lib/errors", () => ({
      AppError: FakeAppError,
    }));

    mock.module("~/server/services/routing/resolvePaymentRoute", () => ({
      resolvePaymentRoute: mock(async () => ({
        id: "route_001",
        providerCode: "SCB",
        billerProfile: {
          id: "bp_001",
          providerCode: "SCB",
          billerId: "biller_001",
          merchantIdAtProvider: "merchant_scb_001",
          credentialsEncrypted: {},
          config: {
            environment: "LIVE",
            apiBaseUrl: "https://api-sandbox.partners.scb",
            apiKey: "key_001",
            apiSecret: "secret_001",
            billerId: "biller_001",
            merchantId: "merchant_scb_001",
          },
        },
      })),
    }));

    mock.module("~/server/services/idempotency/reserveIdempotency", () => ({
      reserveIdempotency: mock(async () => ({
        status: "RESERVED",
        responseBody: null,
      })),
      completeIdempotency: mock(async () => undefined),
      releaseIdempotencyLock: mock(async () => undefined),
    }));

    mock.module("~/server/services/providers/registry", () => ({
      getProviderAdapter: mock(() => ({
        createPayment: mock(async () => ({
          success: true,
          providerReference: "scb-ref-001",
          providerTransactionId: "scb-rt-txn-001",
          qrPayload: "QR_RAW_001",
          deeplinkUrl: "scbeasy://payment/001",
          redirectUrl: null,
          rawRequest: { request: true },
          rawResponse: { response: true },
          errorCode: null,
          errorMessage: null,
        })),
        inquirePayment: mock(async () => ({
          status: "SUCCEEDED",
          providerReference: "scb-ref-001",
          providerTransactionId: "scb-rt-txn-001",
          rawResponse: {},
        })),
      })),
    }));

    mock.module("~/server/services/webhooks/enqueueWebhook", () => ({
      enqueueWebhookForPayment: mock(
        async (paymentIntentId: string, eventType: string) => {
          webhookJobs.push({ paymentIntentId, eventType });
        },
      ),
    }));

    mock.module("~/server/lib/crypto", () => ({
      sha256: (value: string) => `sha256:${value}`,
      hmacSha256: (secret: string, rawBody: string) => `${secret}:${rawBody}`,
      safeCompare: (a: string, b: string) => a === b,
    }));

    const { createPaymentIntent } =
      await import("~~/server/services/payments/createPaymentIntent");
    const callbackRoute = (
      await import("~~/server/api/v1/providers/scb/callback.post")
    ).default as (event: unknown) => Promise<{
      resCode: string;
      resDesc: string;
      transactionId: string;
    }>;
    const { processProviderCallback } =
      await import("~~/server/services/callbacks/processProviderCallback");

    worker = new Worker(
      queueNames.callback,
      async (job) => {
        const data = job.data as { providerCallbackId?: string };
        if (!data.providerCallbackId) {
          throw new Error("providerCallbackId missing");
        }

        await processProviderCallback(data.providerCallbackId);
      },
      {
        connection: redis,
        concurrency: 1,
      },
    );

    await worker.waitUntilReady();

    const created = await createPaymentIntent(
      {
        tenantId: "tenant_001",
        merchantAccountId: "ma_001",
      } as never,
      {
        merchantOrderId: "ORD-001",
        merchantReference: "sess_001",
        amount: "20.00",
        currency: "THB",
        paymentMethodType: "PROMPTPAY_QR",
      } as never,
      {
        idempotencyKey: "idem_001",
      },
    );

    expect(["AWAITING_CUSTOMER", "SUCCEEDED"]).toContain(created.status);
    if (created.status === "AWAITING_CUSTOMER") {
      expect(created.qrPayload).toBe("QR_RAW_001");
    } else {
      expect(created.status).toBe("SUCCEEDED");
      expect(created.qrPayload).toBeNull();
    }

    expect(providerAttempts).toHaveLength(1);

    const rawCallbackBody = JSON.stringify({
      billPaymentRef1: paymentRecord.publicId,
      billPaymentRef3: "PYIQPIRT001PIQRT001",
      transactionId: "scb-rt-txn-001",
      transactionType: "Domestic Transfers",
      amount: "20.00",
      transactionDateandTime: "2026-03-22T10:00:00+07:00",
    });

    const response = await callbackRoute({
      method: "POST",
      path: "/api/v1/providers/scb/callback",
      headers: {
        "x-signature": `secret_scb_test:${rawCallbackBody}`,
      },
      rawBody: rawCallbackBody,
    } as never);

    expect(response.resCode).toBe("00");
    expect(response.resDesc).toBe("success");
    expect(response.transactionId).toBeDefined();

    const queuedCallback = await getProviderCallbackSnapshot();
    expect(queuedCallback).not.toBeNull();
    expect(queuedCallback?.processStatus).toBe("QUEUED");

    await waitForWorkerOutcome(worker);

    const updatedPayment = await getPaymentSnapshot();
    const updatedCallback = await getProviderCallbackSnapshot();

    expect(updatedPayment).not.toBeNull();
    expect(updatedPayment?.status).toBe("SUCCEEDED");
    expect(updatedPayment?.providerTransactionId).toBe("scb-rt-txn-001");
    expect(updatedPayment?.providerReference).toBe(paymentRecord.publicId);

    expect(updatedCallback).not.toBeNull();
    expect(updatedCallback?.processStatus).toBe("PROCESSED");
    expect(updatedCallback?.paymentIntentId).toBe(paymentRecord.id);

    // expect(webhookJobs).toEqual(
    //   expect.arrayContaining([
    //     { paymentIntentId: "pi_rt_001", eventType: "PAYMENT_SUCCEEDED" },
    //   ]),
    // );
  });
});
