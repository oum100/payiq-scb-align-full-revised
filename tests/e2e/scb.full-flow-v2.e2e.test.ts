import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// --- 1. เตรียม Global ของ Nuxt/H3 ก่อนโหลดไฟล์ API ---
(globalThis as any).defineEventHandler = (fn: any) => fn;
(globalThis as any).readRawBody = async (e: any) => e.rawBody || "";
(globalThis as any).getHeader = (e: any, name: string) =>
  e.headers?.[name] ?? e.headers?.[name.toLowerCase()] ?? null;
(globalThis as any).getHeaders = (e: any) => e.headers || {};
(globalThis as any).getQuery = (_e: any) => ({});
(globalThis as any).getRouterParams = (_e: any) => ({});
(globalThis as any).getRouterParam = (_e: any, _key: string) => undefined;
(globalThis as any).readBody = async (e: any) => {
  try {
    return JSON.parse(e.rawBody || "{}");
  } catch {
    return {};
  }
};
(globalThis as any).sendNoContent = async (_e: any, _status?: number) => {};
(globalThis as any).createError = (opts: any) => {
  const err = new Error(opts?.message ?? "Error");
  (err as any).statusCode = opts?.statusCode ?? 500;
  (err as any).statusMessage = opts?.statusMessage;
  return err;
};
(globalThis as any).send = async (_e: any, _data?: any) => {};
(globalThis as any).setResponseStatus = (_e: any, _code: number) => {};
(globalThis as any).setHeader = (_e: any, _name: string, _value: string) => {};
(globalThis as any).setHeaders = (_e: any, _headers: Record<string, string>) => {};

// --- 2. Mock Prisma และ Modules (ทำที่ Top-level) ---
mock.module("~~/server/lib/prisma", () => {
  const mockPrisma = {
    merchantAccount: {
      findFirst: mock(async () => ({
        id: "ma_001",
        tenantId: "tenant_001",
        status: "ACTIVE",
        environment: "SANDBOX", // ← เพิ่ม field ที่ createPaymentIntent ใช้
      })),
    },
    paymentIntent: {
      findFirst: mock(async (args: any) => {
        const where = args?.where;
        // รองรับทั้ง OR condition และ direct lookup
        if (where?.OR) {
          const conditions = where.OR as Array<Record<string, string>>;
          const current = (globalThis as any).__CURRENT_PAYMENT__;
          if (!current) return null;
          const match = conditions.some((cond) => {
            return (
              (cond.publicId && cond.publicId === current.publicId) ||
              (cond.providerReference &&
                cond.providerReference === current.providerReference) ||
              (cond.providerTransactionId &&
                cond.providerTransactionId === current.providerTransactionId) ||
              (cond.merchantReference &&
                cond.merchantReference === current.merchantReference) ||
              (cond.merchantOrderId &&
                cond.merchantOrderId === current.merchantOrderId)
            );
          });
          return match ? current : null;
        }
        if (where?.publicId === "piq_ff_001" || where?.id === "pi_ff_001") {
          return (globalThis as any).__CURRENT_PAYMENT__;
        }
        return null;
      }),
      findUnique: mock(async (args: any) => {
        if (args?.where?.id === "pi_ff_001")
          return (globalThis as any).__CURRENT_PAYMENT__;
        return null;
      }),
      create: mock(async (args: any) => {
        const p = {
          id: "pi_ff_001",
          publicId: "piq_ff_001",
          ...args.data,
          // ตัด nested create (events) ออกไม่ให้ติด spread
          events: undefined,
          status: args.data.status || "CREATED",
        };
        (globalThis as any).__CURRENT_PAYMENT__ = p;
        return p;
      }),
      update: mock(async (args: any) => {
        const p = {
          ...(globalThis as any).__CURRENT_PAYMENT__,
          ...args.data,
        };
        (globalThis as any).__CURRENT_PAYMENT__ = p;
        return p;
      }),
      updateMany: mock(async (args: any) => {
        const p = {
          ...(globalThis as any).__CURRENT_PAYMENT__,
          ...args.data,
        };
        (globalThis as any).__CURRENT_PAYMENT__ = p;
        return { count: 1 };
      }),
    },
    providerCallback: {
      create: mock(async (args: any) => {
        const cb = {
          id: "pcb_ff_001",
          processStatus: null,
          processedAt: null,
          signatureValid: null,
          paymentIntentId: null,
          providerReference: "piq_ff_001",
          providerTxnId: "scb-ff-txn-001",
          ...args.data,
          body: {
            ...(args.data.body ?? {}),
            _normalized: {
              providerReference: "piq_ff_001",
              providerTxnId: "scb-ff-txn-001",
              normalizedStatus: "SUCCEEDED",
            },
          },
        };
        (globalThis as any).__CURRENT_CALLBACK__ = cb;
        return cb;
      }),
      findUnique: mock(
        async () => (globalThis as any).__CURRENT_CALLBACK__
      ),
      update: mock(async (args: any) => {
        const cb = {
          ...(globalThis as any).__CURRENT_CALLBACK__,
          ...args.data,
        };
        (globalThis as any).__CURRENT_CALLBACK__ = cb;
        return cb;
      }),
    },
    paymentEvent: { create: mock(async () => ({ id: "pe_001" })) },
    providerAttempt: { create: mock(async () => ({ id: "pa_001" })) },
    webhookEndpoint: { findMany: mock(async () => [{ id: "we_001" }]) },
    webhookDelivery: { create: mock(async () => ({ id: "wd_001" })) },
    $transaction: mock(async (fn: any) => fn(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

// ── applyPaymentTransition: อัปเดต __CURRENT_PAYMENT__ แล้วคืน { payment } ──
mock.module("~~/server/services/payments/stateMachine", () => ({
  applyPaymentTransition: mock(async (args: any) => {
    const current = (globalThis as any).__CURRENT_PAYMENT__ ?? {};
    const updated = {
      ...current,
      ...(args.patch ?? {}),
      status: args.toStatus,
    };
    (globalThis as any).__CURRENT_PAYMENT__ = updated;
    return { payment: updated };
  }),
}));

// ── storeProviderCallback: สร้าง callback stub แล้วเก็บไว้ใน __CURRENT_CALLBACK__ ──
mock.module("~~/server/services/callbacks/storeProviderCallback", () => ({
  storeProviderCallback: mock(async (args: any) => {
    const cb = {
      id: "pcb_ff_001",
      processStatus: null,
      processedAt: null,
      signatureValid: null,
      paymentIntentId: null,
      providerReference: args.providerReference ?? "piq_ff_001",
      providerTxnId: args.providerTxnId ?? "scb-ff-txn-001",
      body: {
        ...(args.body ?? {}),
        _normalized: {
          providerReference: args.providerReference ?? "piq_ff_001",
          providerTxnId: args.providerTxnId ?? "scb-ff-txn-001",
          normalizedStatus: "SUCCEEDED",
        },
      },
      queryParams: args.queryParams ?? {},
    };
    (globalThis as any).__CURRENT_CALLBACK__ = cb;
    return cb;
  }),
}));

// ── normalizeScbCallback: parse rawBody และคืน normalized fields ──
mock.module("~~/server/services/providers/scb/scb.webhook", () => ({
  normalizeScbCallback: mock((args: any) => {
    let parsed: any = {};
    try {
      parsed = JSON.parse(args.rawBody || "{}");
    } catch {
      // ignore
    }
    return {
      providerReference: parsed.billPaymentRef1 ?? null,
      providerTxnId: parsed.transactionId ?? null,
      providerQrRef: parsed.billPaymentRef3 ?? null,
      billPaymentRef1: parsed.billPaymentRef1 ?? null,
      billPaymentRef2: parsed.billPaymentRef2 ?? null,
      billPaymentRef3: parsed.billPaymentRef3 ?? null,
      externalStatus: parsed.status ?? null,
      normalizedStatus: "SUCCEEDED",
      eventId: parsed.transactionId ?? null,
      signatureValid: true,
      enrichedBody: parsed,
    };
  }),
}));

// ── AppError ──
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

mock.module("~~/server/services/routing/resolvePaymentRoute", () => ({
  resolvePaymentRoute: async () => ({
    id: "route_001",
    providerCode: "SCB",
    billerProfile: {
      id: "bp_001",
      providerCode: "SCB",
      billerId: "biller_001",
      merchantIdAtProvider: "mid_001",
      environment: "SANDBOX",
      credentialsRef: null,
      credentialsEncrypted: null,
      config: { apiKey: "k", apiSecret: "s" },
    },
  }),
}));

mock.module("~~/server/services/idempotency/reserveIdempotency", () => ({
  reserveIdempotency: async () => ({ status: "RESERVED" }),
  completeIdempotency: async () => {},
  releaseIdempotencyLock: async () => {},
}));

mock.module("~~/server/services/providers/registry", () => ({
  getProviderAdapter: () => ({
    createPayment: async () => ({
      success: true,
      providerReference: "piq_ff_001",
      providerTransactionId: "scb-ff-txn-001",
      qrPayload: "QR_RAW_001",
    }),
  }),
}));

mock.module("~~/server/lib/bullmq", () => ({
  callbackQueue: {
    add: async (_: any, data: any) =>
      (globalThis as any).__QUEUE_JOBS__.push(data),
  },
}));

mock.module("~~/server/services/webhooks/enqueueWebhook", () => ({
  enqueueWebhookForPayment: async (id: string, type: string) => {
    (globalThis as any).__WEBHOOK_JOBS__.push({ id, type });
  },
}));

// ── nanoid: คืน id ที่คาดเดาได้ ──
mock.module("nanoid", () => ({
  nanoid: () => "ff_001_deterministic_000000",
}));

describe("SCB full flow e2e-lite", () => {
  const originalAppBaseUrl = process.env.APP_BASE_URL;
  const originalScbCallbackSecret = process.env.SCB_CALLBACK_SECRET;

  beforeEach(() => {
    (globalThis as any).__CURRENT_PAYMENT__ = null;
    (globalThis as any).__CURRENT_CALLBACK__ = null;
    (globalThis as any).__QUEUE_JOBS__ = [];
    (globalThis as any).__WEBHOOK_JOBS__ = [];
    process.env.APP_BASE_URL = "https://payiq.example.com";
    process.env.SCB_CALLBACK_SECRET = "secret_scb_test";
  });

  afterEach(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
    process.env.SCB_CALLBACK_SECRET = originalScbCallbackSecret;
  });

  test("create payment -> callback ingress -> callback process -> payment succeeded", async () => {
    const { createPaymentIntent } = await import(
      "~~/server/services/payments/createPaymentIntent"
    );
    const callbackRouteHandler = (
      await import("~~/server/api/v1/providers/scb/callback.post")
    ).default;
    const { processProviderCallback } = await import(
      "~~/server/services/callbacks/processProviderCallback"
    );

    // 1. Create payment
    const result = await createPaymentIntent(
      { tenantId: "tenant_001", merchantAccountId: "ma_001" } as any,
      {
        amount: "20.00",
        currency: "THB",
        paymentMethodType: "PROMPTPAY_QR",
      } as any,
      { idempotencyKey: "idem_001" }
    );

    expect(result.status).toBe("AWAITING_CUSTOMER");
    expect((globalThis as any).__CURRENT_PAYMENT__).not.toBeNull();

    // 2. Callback ingress
    const rawBody = JSON.stringify({
      billPaymentRef1: "piq_ff_001",
      transactionId: "scb-ff-txn-001",
      amount: "20.00",
    });

    await (callbackRouteHandler as any)({
      method: "POST",
      headers: { "x-signature": `secret_scb_test:${rawBody}` },
      rawBody,
    });

    expect((globalThis as any).__CURRENT_CALLBACK__).not.toBeNull();
    expect((globalThis as any).__CURRENT_CALLBACK__.id).toBe("pcb_ff_001");

    // 3. Process callback (จุดที่เคยติด Transaction Error)
    const processResult = await processProviderCallback("pcb_ff_001");

    expect(processResult?.ok).toBe(true);
    expect(processResult?.skipped).toBeUndefined();

    // 4. Assert final state
    const payment = (globalThis as any).__CURRENT_PAYMENT__;
    expect(payment?.status).toBe("SUCCEEDED");

    expect((globalThis as any).__WEBHOOK_JOBS__).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "PAYMENT_SUCCEEDED" }),
      ])
    );
  });
});