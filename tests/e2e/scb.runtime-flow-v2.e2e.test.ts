/**
 * SCB runtime flow e2e test
 *
 * แก้ไขหลัก:
 * 1. ย้าย mock.module ทั้งหมดออกมา top-level (Bun ต้องการ mock ก่อน import)
 * 2. mock scb.mapper ที่ scb.webhook.ts ต้องการ
 * 3. mock crypto เพื่อให้ storeProviderCallback ทำงานได้
 * 4. ไม่ mock bullmq/redis เพราะใช้ real queue
 * 5. Worker ใช้ static import แทน dynamic import พร้อม ?v= query string
 *    ที่ Bun ไม่รองรับ
 * 6. mock.module ต้องครอบคลุม stateMachine ด้วย เพราะ applyPaymentTransition
 *    ใช้ prisma.$transaction ภายใน — แทนที่ด้วย implementation ที่ควบคุมได้
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { callbackQueue, queueNames } from "~~/server/lib/bullmq";
import { redis } from "~~/server/lib/redis";

// ─── Types ───────────────────────────────────────────────────────────────────

function makeDecimal(value: string) {
  return { toString() { return value; } };
}

type DecimalLike = { toString(): string };

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

// ─── State ที่แชร์ระหว่าง mock ต่าง ๆ (ต้องเป็น module-level เพื่อให้ worker เข้าถึงได้) ──

const state = {
  paymentExists: false,
  payment: null as PaymentRecord | null,
  callback: null as ProviderCallbackRecord | null,
  providerAttempts: [] as Array<Record<string, unknown>>,
  webhookJobs: [] as Array<Record<string, unknown>>,
};

function resetState() {
  state.paymentExists = false;
  state.payment = null;
  state.callback = null;
  state.providerAttempts = [];
  state.webhookJobs = [];
}

function clonePayment(): PaymentRecord | null {
  if (!state.payment) return null;
  return { ...state.payment, amount: makeDecimal(state.payment.amount.toString()) };
}

function cloneCallback(): ProviderCallbackRecord | null {
  return state.callback ? { ...state.callback } : null;
}

function matchPayment(where?: PaymentWhere): PaymentRecord | null {
  if (!state.paymentExists || !state.payment || !where) return null;
  const p = state.payment;

  if (typeof where.merchantOrderId === "string" && where.merchantOrderId === p.merchantOrderId) {
    return clonePayment();
  }

  const orList = Array.isArray(where.OR) ? (where.OR as Array<Record<string, unknown>>) : [];
  for (const cond of orList) {
    if (typeof cond.providerTransactionId === "string" && cond.providerTransactionId === p.providerTransactionId) return clonePayment();
    if (typeof cond.publicId === "string" && cond.publicId === p.publicId) return clonePayment();
    if (typeof cond.providerReference === "string" && cond.providerReference === p.providerReference) return clonePayment();
    if (typeof cond.merchantReference === "string" && cond.merchantReference === p.merchantReference) return clonePayment();
    if (typeof cond.merchantOrderId === "string" && cond.merchantOrderId === p.merchantOrderId) return clonePayment();
  }
  return null;
}

function patchPayment(patch: Record<string, unknown>) {
  if (!state.payment) return;
  state.payment = {
    ...state.payment,
    status: typeof patch.status === "string" ? patch.status : state.payment.status,
    providerReference: "providerReference" in patch ? (patch.providerReference as string | null ?? null) : state.payment.providerReference,
    providerTransactionId: "providerTransactionId" in patch ? (patch.providerTransactionId as string | null ?? null) : state.payment.providerTransactionId,
    qrPayload: "qrPayload" in patch ? (patch.qrPayload as string | null ?? null) : state.payment.qrPayload,
    deeplinkUrl: "deeplinkUrl" in patch ? (patch.deeplinkUrl as string | null ?? null) : state.payment.deeplinkUrl,
    redirectUrl: "redirectUrl" in patch ? (patch.redirectUrl as string | null ?? null) : state.payment.redirectUrl,
    succeededAt: "succeededAt" in patch ? (patch.succeededAt as Date | null ?? null) : state.payment.succeededAt,
    failedAt: "failedAt" in patch ? (patch.failedAt as Date | null ?? null) : state.payment.failedAt,
    expiredAt: "expiredAt" in patch ? (patch.expiredAt as Date | null ?? null) : state.payment.expiredAt,
  };
}

function patchCallback(patch: Record<string, unknown>) {
  if (!state.callback) throw new Error("callback missing");
  state.callback = {
    ...state.callback,
    paymentIntentId: "paymentIntentId" in patch ? (patch.paymentIntentId as string | null ?? null) : state.callback.paymentIntentId,
    processStatus: typeof patch.processStatus === "string" ? patch.processStatus : state.callback.processStatus,
    errorMessage: "errorMessage" in patch ? (patch.errorMessage as string | null ?? null) : state.callback.errorMessage,
    processedAt: "processedAt" in patch ? (patch.processedAt as Date | null ?? null) : state.callback.processedAt,
    failedAt: "failedAt" in patch ? (patch.failedAt as Date | null ?? null) : state.callback.failedAt,
  };
}

// ─── Prisma mock (top-level เพื่อให้ worker ได้ module เดียวกัน) ───────────────

mock.module("~~/server/lib/prisma", () => {
  // tx object ที่ใช้ใน $transaction — ต้องมีทุก method ที่ stateMachine เรียก
  const makeTx = () => ({
    paymentIntent: {
      findUnique: async (_args: unknown) => clonePayment(),
      findFirst: async (args: unknown) => matchPayment((args as any)?.where),
      update: async (args: unknown) => {
        patchPayment((args as any).data);
        return clonePayment()!;
      },
      updateMany: async (args: unknown) => {
        patchPayment((args as any).data);
        return { count: 1 };
      },
    },
    paymentEvent: {
      create: async (_args: unknown) => ({ id: "pe_001" }),
    },
    providerCallback: {
      findUnique: async (_args: unknown) => cloneCallback(),
      update: async (args: unknown) => {
        patchCallback((args as any).data);
        return { id: state.callback?.id ?? "pcb_rt_001" };
      },
    },
  });

  const mockPrisma = {
    merchantAccount: {
      findFirst: mock(async () => ({
        id: "ma_001",
        tenantId: "tenant_001",
        status: "ACTIVE",
        environment: "SANDBOX",
      })),
    },

    paymentIntent: {
      findFirst: mock(async (args?: { where?: PaymentWhere }) => matchPayment(args?.where)),
      findUnique: mock(async (_args?: unknown) => clonePayment()),
      create: mock(async (args: { data: Record<string, unknown> }) => {
        state.paymentExists = true;
        state.payment = {
          id: "pi_rt_001",
          publicId: "piq_rt_001",
          tenantId: String(args.data.tenantId),
          merchantAccountId: String(args.data.merchantAccountId),
          paymentRouteId: String(args.data.paymentRouteId),
          billerProfileId: String(args.data.billerProfileId),
          merchantOrderId: typeof args.data.merchantOrderId === "string" ? args.data.merchantOrderId : null,
          merchantReference: typeof args.data.merchantReference === "string" ? args.data.merchantReference : null,
          providerCode: String(args.data.providerCode),
          currency: String(args.data.currency),
          amount: makeDecimal(String(args.data.amount)),
          status: String(args.data.status || "CREATED"),
          qrPayload: null,
          deeplinkUrl: null,
          redirectUrl: null,
          expiresAt: args.data.expiresAt instanceof Date ? args.data.expiresAt : new Date(Date.now() + 15 * 60 * 1000),
          providerReference: null,
          providerTransactionId: null,
          succeededAt: null,
          failedAt: null,
          expiredAt: null,
        };
        return {
          id: state.payment.id,
          publicId: state.payment.publicId,
          amount: state.payment.amount,
          currency: state.payment.currency,
          merchantOrderId: state.payment.merchantOrderId,
          expiresAt: state.payment.expiresAt,
        };
      }),
      update: mock(async (args: { data: Record<string, unknown> }) => {
        patchPayment(args.data);
        return clonePayment()!;
      }),
      updateMany: mock(async (args: { data: Record<string, unknown> }) => {
        patchPayment(args.data);
        return { count: 1 };
      }),
    },

    paymentEvent: {
      create: mock(async () => ({ id: "pe_001" })),
    },

    providerAttempt: {
      create: mock(async (args: { data: Record<string, unknown> }) => {
        state.providerAttempts.push(args.data);
        return { id: "pa_001" };
      }),
    },

    providerCallback: {
      create: mock(async (args: { data: Record<string, unknown> }) => {
        state.callback = {
          id: "pcb_rt_001",
          paymentIntentId: null,
          processStatus: String(args.data.processStatus ?? "RECEIVED"),
          signatureValid: typeof args.data.signatureValid === "boolean" ? args.data.signatureValid : null,
          providerReference: typeof args.data.providerReference === "string" ? args.data.providerReference : null,
          providerTxnId: typeof args.data.providerTxnId === "string" ? args.data.providerTxnId : null,
          body: {
            ...(args.data.body as Record<string, unknown> ?? {}),
            _normalized: {
              providerReference: state.payment?.publicId ?? "piq_rt_001",
              providerTxnId: "scb-rt-txn-001",
              normalizedStatus: "SUCCEEDED",
              externalStatus: "SUCCESS",
              eventId: "scb-rt-txn-001",
              billPaymentRef1: state.payment?.publicId ?? "piq_rt_001",
              billPaymentRef2: null,
              billPaymentRef3: "PYIQPIRT001PIQRT001",
            },
          },
          errorMessage: null,
          processedAt: null,
          failedAt: null,
        };
        return { id: "pcb_rt_001" };
      }),
      findUnique: mock(async (_args?: unknown) => cloneCallback()),
      update: mock(async (args: { data: Record<string, unknown> }) => {
        patchCallback(args.data);
        return { id: "pcb_rt_001" };
      }),
    },

    webhookEndpoint: {
      findMany: mock(async () => [{ id: "we_001", tenantId: "tenant_001", status: "ACTIVE" }]),
    },

    webhookDelivery: {
      create: mock(async () => ({ id: "wd_001" })),
    },

    $transaction: mock(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      return fn(makeTx());
    }),
  };

  return { prisma: mockPrisma };
});

// ─── Other top-level mocks ────────────────────────────────────────────────────

mock.module("~~/server/lib/errors", () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

mock.module("~~/server/lib/crypto", () => ({
  sha256: (value: string) => `sha256:${value}`,
  hmacSha256: (secret: string, rawBody: string) => `${secret}:${rawBody}`,
  safeCompare: (a: string, b: string) => a === b,
}));

// scb.mapper ที่ scb.webhook.ts import
mock.module("~~/server/services/providers/scb/scb.mapper", () => ({
  mapScbStatusToInternal: (status: string) => {
    const map: Record<string, string> = {
      SUCCESS: "SUCCEEDED",
      FAILED: "FAILED",
      PENDING: "PENDING",
      EXPIRED: "EXPIRED",
    };
    return map[status?.toUpperCase()] ?? null;
  },
}));

mock.module("~~/server/services/routing/resolvePaymentRoute", () => ({
  resolvePaymentRoute: mock(async () => ({
    id: "route_001",
    providerCode: "SCB",
    billerProfile: {
      id: "bp_001",
      providerCode: "SCB",
      billerId: "biller_001",
      merchantIdAtProvider: "merchant_scb_001",
      environment: "SANDBOX",
      credentialsRef: null,
      credentialsEncrypted: {},
      config: {
        environment: "SANDBOX",
        apiBaseUrl: "https://api-sandbox.partners.scb",
        apiKey: "key_001",
        apiSecret: "secret_001",
        billerId: "biller_001",
        merchantId: "merchant_scb_001",
      },
    },
  })),
}));

mock.module("~~/server/services/idempotency/reserveIdempotency", () => ({
  reserveIdempotency: mock(async () => ({ status: "RESERVED", responseBody: null })),
  completeIdempotency: mock(async () => undefined),
  releaseIdempotencyLock: mock(async () => undefined),
}));

mock.module("~~/server/services/providers/registry", () => ({
  getProviderAdapter: mock(() => ({
    createPayment: mock(async () => ({
      success: true,
      providerReference: "piq_rt_001",
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
      providerReference: "piq_rt_001",
      providerTransactionId: "scb-rt-txn-001",
      rawResponse: {},
    })),
  })),
}));

mock.module("~~/server/services/webhooks/enqueueWebhook", () => ({
  enqueueWebhookForPayment: mock(async (paymentIntentId: string, eventType: string) => {
    state.webhookJobs.push({ paymentIntentId, eventType });
  }),
}));

// nanoid — ให้ได้ค่าคงที่เพื่อ predictable dedupeKey
mock.module("nanoid", () => ({
  nanoid: (size?: number) => "test_nano_" + "x".repeat(size ?? 21),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForWorkerOutcome(worker: Worker, timeoutMs = 15000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Worker outcome not observed within ${timeoutMs}ms`));
    }, timeoutMs);

    const onCompleted = () => { cleanup(); resolve(); };
    const onFailed = (_job: Job | undefined, error: Error) => { cleanup(); reject(error); };
    const cleanup = () => {
      clearTimeout(timeout);
      worker.off("completed", onCompleted);
      worker.off("failed", onFailed);
    };

    worker.on("completed", onCompleted);
    worker.on("failed", onFailed);
  });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

describe("SCB runtime flow e2e", () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalScbCallbackSecret = process.env.SCB_CALLBACK_SECRET;

  let worker: Worker | null = null;

  beforeEach(async () => {
    resetState();

    process.env.APP_BASE_URL = "https://payiq.example.com";
    process.env.SCB_CALLBACK_SECRET = "secret_scb_test";

    // H3 globals
    (globalThis as any).defineEventHandler = (fn: any) => fn;
    (globalThis as any).readRawBody = async (event: any) => event.rawBody || "";
    (globalThis as any).getHeaders = (event: any) => event.headers || {};
    (globalThis as any).getQuery = (event: any) => event.query || {};
    (globalThis as any).getHeader = (event: any, name: string) => {
      const h = event.headers || {};
      return h[name] ?? h[name.toLowerCase()] ?? h[name.toUpperCase()] ?? null;
    };

    await callbackQueue.obliterate({ force: true });
  });

  afterEach(async () => {
    if (worker) {
      await worker.close();
      worker = null;
    }
    await callbackQueue.obliterate({ force: true }).catch(() => undefined);

    delete (globalThis as any).defineEventHandler;
    delete (globalThis as any).readRawBody;
    delete (globalThis as any).getHeaders;
    delete (globalThis as any).getQuery;
    delete (globalThis as any).getHeader;

    process.env.APP_BASE_URL = originalAppBaseUrl ?? undefined;
    process.env.SCB_CALLBACK_SECRET = originalScbCallbackSecret ?? undefined;
  });

  test("create payment -> callback ingress -> real queue worker -> payment succeeded", async () => {
    // import หลังจาก mock ถูก setup ทั้งหมดแล้ว
    const { createPaymentIntent } = await import("~~/server/services/payments/createPaymentIntent");
    const callbackRoute = (await import("~~/server/api/v1/providers/scb/callback.post")).default as (
      event: unknown
    ) => Promise<{ resCode: string; resDesc: string; transactionId: string }>;
    const { processProviderCallback } = await import(
      "~~/server/services/callbacks/processProviderCallback"
    );

    // Worker ใช้ module ที่ import ไว้แล้ว (ซึ่ง mock ถูก apply แล้ว)
    // ไม่ใช้ dynamic import พร้อม query string เพราะ Bun ไม่รองรับ
    worker = new Worker(
      queueNames.callback,
      async (job) => {
        return await processProviderCallback(job.data.providerCallbackId);
      },
      {
        connection: redis,
        concurrency: 1,
      },
    );

    await worker.waitUntilReady();

    // ── Step 1: Create payment ────────────────────────────────────────────────
    const created = await createPaymentIntent(
      { tenantId: "tenant_001", merchantAccountId: "ma_001" } as never,
      {
        merchantOrderId: "ORD-001",
        merchantReference: "sess_001",
        amount: "20.00",
        currency: "THB",
        paymentMethodType: "PROMPTPAY_QR",
      } as never,
      { idempotencyKey: "idem_001" },
    );

    expect(["AWAITING_CUSTOMER", "SUCCEEDED"]).toContain(created.status);
    if (created.status === "AWAITING_CUSTOMER") {
      expect(created.qrPayload).toBe("QR_RAW_001");
    }

    expect(state.providerAttempts).toHaveLength(1);
    expect(state.paymentExists).toBe(true);
    expect(state.payment?.publicId).toBe("piq_rt_001");

    // ── Step 2: Callback ingress ──────────────────────────────────────────────
    const rawCallbackBody = JSON.stringify({
      billPaymentRef1: state.payment!.publicId, // "piq_rt_001"
      billPaymentRef3: "PYIQPIRT001PIQRT001",
      transactionId: "scb-rt-txn-001",
      transactionType: "Domestic Transfers",
      amount: "20.00",
      transactionDateandTime: "2026-03-22T10:00:00+07:00",
    });

    const response = await callbackRoute({
      method: "POST",
      path: "/api/v1/providers/scb/callback",
      headers: { "x-signature": `secret_scb_test:${rawCallbackBody}` },
      rawBody: rawCallbackBody,
    } as never);

    expect(response.resCode).toBe("00");
    expect(response.resDesc).toBe("success");
    expect(response.transactionId).toBeDefined();

    // callback ถูกสร้างและ enqueue แล้ว
    expect(state.callback).not.toBeNull();
    expect(state.callback?.processStatus).toBe("QUEUED");

    // ── Step 3: Worker process ────────────────────────────────────────────────
    await waitForWorkerOutcome(worker);

    // ── Step 4: Assert ────────────────────────────────────────────────────────
    const finalPayment = clonePayment();
    const finalCallback = cloneCallback();

    expect(finalPayment).not.toBeNull();
    expect(finalPayment?.status).toBe("SUCCEEDED");
    expect(finalPayment?.providerTransactionId).toBe("scb-rt-txn-001");
    expect(finalPayment?.providerReference).toBe("piq_rt_001");

    expect(finalCallback).not.toBeNull();
    expect(finalCallback?.processStatus).toBe("PROCESSED");
    expect(finalCallback?.paymentIntentId).toBe("pi_rt_001");

    expect(state.webhookJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "PAYMENT_SUCCEEDED" }),
      ]),
    );
  });
});