/**
 * callback.hardening-v2.integration.test.ts
 *
 * แก้ไขหลัก:
 * - ลบ afterEach ที่ทำ mock.module("~~/server/lib/prisma", ...) ออก
 *   เพราะมันเขียนทับ module cache ด้วย incomplete object ทำให้ test อื่น
 *   (โดยเฉพาะ scb.runtime-flow-v2.e2e.test.ts) crash ด้วย
 *   "undefined is not an object (evaluating 'paymentIntent.publicId')"
 *
 * - แต่ละ test ใช้ dynamic import พร้อม ?t=random เพื่อให้ได้ module instance
 *   ใหม่ที่ใช้ mock ของตัวเองโดยไม่กระทบ test อื่น
 *
 * - mock.module ในแต่ละ test ทำงานเฉพาะ test นั้น เพราะ Bun re-evaluate
 *   factory เมื่อมี dynamic import หลัง mock.module ถูก set
 */

import { describe, test, expect, mock } from "bun:test";

describe("callback hardening", () => {
  // ❌ ลบ afterEach ที่ re-mock prisma ด้วย incomplete object ออกทั้งหมด
  //    เพราะมันทำให้ module cache ของ prisma เสียหายและ test อื่นพัง

  test("should skip duplicate (processedAt)", async () => {
    mock.module("~~/server/lib/prisma", () => ({
      prisma: {
        providerCallback: {
          findUnique: async () => ({
            id: "pcb_1",
            processStatus: "PROCESSED",
            processedAt: new Date(),
          }),
          update: async () => ({}),
        },
        paymentIntent: {
          findFirst: async () => null,
          findUnique: async () => null,
          update: async () => ({}),
          updateMany: async () => ({ count: 0 }),
        },
        paymentEvent: { create: async () => ({ id: "pe_001" }) },
        $transaction: async (fn: any) =>
          fn({
            paymentIntent: {
              findUnique: async () => null,
              findFirst: async () => null,
              update: async () => ({}),
              updateMany: async () => ({ count: 0 }),
            },
            paymentEvent: { create: async () => ({ id: "pe_001" }) },
            providerCallback: {
              findUnique: async () => null,
              update: async () => ({}),
            },
          }),
      },
    }));

    mock.module("~~/server/services/payments/stateMachine", () => ({
      applyPaymentTransition: async () => ({ applied: false }),
    }));

    mock.module("~~/server/services/webhooks/enqueueWebhook", () => ({
      enqueueWebhookForPayment: async () => {},
    }));

    const { processProviderCallback } = await import(
      `../../server/services/callbacks/processProviderCallback?t=${Math.random()}`
    );
    const result = await processProviderCallback("pcb_1");

    expect(result).toBeDefined();
    expect(result?.skipped).toBe(true);
    expect(result?.reason).toBe("already processed");
  });

  test("should skip if payment already final", async () => {
    mock.module("~~/server/lib/prisma", () => ({
      prisma: {
        providerCallback: {
          findUnique: async () => ({
            id: "pcb_2",
            processStatus: "PENDING",
            processedAt: null,
            signatureValid: true,
            paymentIntentId: null,
            providerReference: "ref_1",
            providerTxnId: null,
            body: {
              _normalized: {
                providerReference: "ref_1",
                normalizedStatus: "SUCCEEDED",
              },
            },
          }),
          update: async () => ({}),
        },
        paymentIntent: {
          findFirst: async () => ({
            id: "pi_1",
            status: "SUCCEEDED",
          }),
          findUnique: async () => null,
          update: async () => ({}),
          updateMany: async () => ({ count: 0 }),
        },
        paymentEvent: { create: async () => ({ id: "pe_001" }) },
        $transaction: async (fn: any) =>
          fn({
            paymentIntent: {
              findUnique: async () => null,
              findFirst: async () => null,
              update: async () => ({}),
              updateMany: async () => ({ count: 0 }),
            },
            paymentEvent: { create: async () => ({ id: "pe_001" }) },
            providerCallback: {
              findUnique: async () => null,
              update: async () => ({}),
            },
          }),
      },
    }));

    mock.module("~~/server/services/payments/stateMachine", () => ({
      applyPaymentTransition: async () => ({ applied: false }),
    }));

    mock.module("~~/server/services/webhooks/enqueueWebhook", () => ({
      enqueueWebhookForPayment: async () => {},
    }));

    const { processProviderCallback } = await import(
      `../../server/services/callbacks/processProviderCallback?t=${Math.random()}`
    );
    const result = await processProviderCallback("pcb_2");

    expect(result).toBeDefined();
    expect(result?.skipped).toBe(true);
    expect(result?.reason).toBe("payment already final");
  });

  test("should process normally", async () => {
    let webhookCalled = false;

    mock.module("~~/server/lib/prisma", () => ({
      prisma: {
        providerCallback: {
          findUnique: async () => ({
            id: "pcb_3",
            processStatus: "PENDING",
            processedAt: null,
            signatureValid: true,
            paymentIntentId: null,
            providerReference: "ref_1",
            providerTxnId: null,
            body: {
              _normalized: {
                providerReference: "ref_1",
                normalizedStatus: "SUCCEEDED",
              },
            },
          }),
          update: async () => ({}),
        },
        paymentIntent: {
          findFirst: async () => ({
            id: "pi_1",
            status: "AWAITING_CUSTOMER",
            providerReference: null,
            providerTransactionId: null,
          }),
          findUnique: async () => null,
          update: async () => ({}),
          updateMany: async () => ({ count: 0 }),
        },
        paymentEvent: { create: async () => ({ id: "pe_001" }) },
        $transaction: async (fn: any) =>
          fn({
            paymentIntent: {
              findUnique: async () => null,
              findFirst: async () => null,
              update: async () => ({}),
              updateMany: async () => ({ count: 0 }),
            },
            paymentEvent: { create: async () => ({ id: "pe_001" }) },
            providerCallback: {
              findUnique: async () => null,
              update: async () => ({}),
            },
          }),
      },
    }));

    mock.module("~~/server/services/payments/stateMachine", () => ({
      applyPaymentTransition: async () => ({
        applied: true,
        payment: { id: "pi_1", status: "SUCCEEDED" },
      }),
    }));

    mock.module("~~/server/services/webhooks/enqueueWebhook", () => ({
      enqueueWebhookForPayment: async () => {
        webhookCalled = true;
      },
    }));

    const { processProviderCallback } = await import(
      `../../server/services/callbacks/processProviderCallback?t=${Math.random()}`
    );

    const result = await processProviderCallback("pcb_3");

    expect(result).toBeDefined();
    expect(result?.ok).toBe(true);
    expect(webhookCalled).toBe(true);
  });
});
