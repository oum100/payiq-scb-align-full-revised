/**
 * POST /api/v1/payments/cash/collect
 *
 * IoT / Standalone coin acceptor — auto-create + confirm in one shot.
 *
 * Use this when the device collects cash on its own and needs to
 * record + confirm the payment atomically.
 *
 * Body:
 *   merchantOrderId  string   — unique session/cycle ID (idempotency key)
 *   amount           string   — expected amount (e.g. "20.00")
 *   receivedAmount   string   — amount physically collected (may equal or exceed amount)
 *   note?            string   — optional label, e.g. "Washer A1 - 30min"
 *   customerName?    string
 *   metadata?        object
 */

import { z } from "zod"
import { nanoid } from "nanoid"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"
import { requireApiKeyAuth } from "~~/server/lib/auth"
import { requireScope } from "~~/server/services/auth/requireScope"
import { applyPaymentTransition } from "~~/server/services/payments/stateMachine"
import { enqueueWebhookForPayment } from "~~/server/services/webhooks/enqueueWebhook"

const schema = z.object({
  merchantOrderId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  receivedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().optional(),
  customerName: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const auth = await requireApiKeyAuth(event)
    requireScope(auth, "payments:create")

    if (!auth.merchantAccountId) {
      throw new AppError("FORBIDDEN", "API key is not bound to a merchant account", 403)
    }

    const body = schema.parse(await readBody(event))

    const merchant = await prisma.merchantAccount.findFirst({
      where: { id: auth.merchantAccountId, tenantId: auth.tenantId, status: "ACTIVE" },
    })
    if (!merchant) throw new AppError("MERCHANT_NOT_FOUND", "Merchant not found or inactive", 404)

    // ── Find existing intent by merchantOrderId ─────────────────────────────
    let intent = await prisma.paymentIntent.findFirst({
      where: {
        tenantId: auth.tenantId,
        merchantAccountId: merchant.id,
        merchantOrderId: body.merchantOrderId,
      },
    })

    // ── Idempotent: already SUCCEEDED ───────────────────────────────────────
    if (intent?.status === "SUCCEEDED") {
      return {
        publicId: intent.publicId,
        status: "SUCCEEDED",
        merchantOrderId: intent.merchantOrderId,
        amount: intent.amount.toString(),
        receivedAmount: body.receivedAmount,
        alreadyConfirmed: true,
      }
    }

    // ── Auto-create if not found ─────────────────────────────────────────────
    if (!intent) {
      const publicId = `piq_${nanoid(16)}`

      intent = await prisma.paymentIntent.create({
        data: {
          tenantId: auth.tenantId,
          merchantAccountId: merchant.id,
          publicId,
          merchantOrderId: body.merchantOrderId,
          paymentMethodType: "CASH",
          environment: merchant.environment,
          currency: "THB",
          amount: body.amount,
          feeAmount: "0",
          netAmount: body.amount,
          status: "CREATED",
          customerName: body.customerName ?? null,
          description: body.note ?? null,
          ...(body.metadata !== undefined ? { metadata: body.metadata as never } : {}),
          events: {
            create: [{ type: "PAYMENT_CREATED", toStatus: "CREATED", summary: "Cash intent auto-created by IoT" }],
          },
        },
      })

      // CREATED → AWAITING_CUSTOMER
      await applyPaymentTransition({
        paymentIntentId: intent.id,
        toStatus: "AWAITING_CUSTOMER",
        eventType: "PROVIDER_ACCEPTED",
        summary: "Cash payment awaiting collection",
      })
    }

    // ── Confirm: AWAITING_CUSTOMER → SUCCEEDED ──────────────────────────────
    await applyPaymentTransition({
      paymentIntentId: intent.id,
      toStatus: "SUCCEEDED",
      eventType: "CASH_COLLECTED",
      summary: `Cash collected: ${body.receivedAmount} THB (expected: ${body.amount} THB)${body.note ? ` — ${body.note}` : ""}`,
      patch: {
        succeededAt: new Date(),
        extra: {
          receivedAmount: body.receivedAmount,
          collectedBy: "IOT",
          ...(body.note ? { note: body.note } : {}),
        },
      },
      payload: {
        receivedAmount: body.receivedAmount,
        expectedAmount: body.amount,
        collectedBy: "IOT",
        ...(body.note ? { note: body.note } : {}),
      },
    })

    await enqueueWebhookForPayment(intent.id, "PAYMENT_SUCCEEDED")

    return {
      publicId: intent.publicId,
      status: "SUCCEEDED",
      merchantOrderId: intent.merchantOrderId,
      amount: intent.amount.toString(),
      receivedAmount: body.receivedAmount,
      alreadyConfirmed: false,
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      setResponseStatus(event, error.statusCode)
      return { error: error.code, message: error.message }
    }
    setResponseStatus(event, 400)
    return { error: "BAD_REQUEST", message: error?.message ?? "Invalid request" }
  }
})
