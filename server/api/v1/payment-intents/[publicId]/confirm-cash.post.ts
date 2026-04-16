/**
 * POST /api/v1/payment-intents/:publicId/confirm-cash
 *
 * KIOSK / Option A — intent already created, KIOSK confirms once cash is collected.
 *
 * Body:
 *   receivedAmount  string  — amount physically collected
 *   note?           string  — optional label, e.g. "Lane 3 - Bill accepted"
 */

import { z } from "zod"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"
import { requireApiKeyAuth } from "~~/server/lib/auth"
import { requireScope } from "~~/server/services/auth/requireScope"
import { applyPaymentTransition } from "~~/server/services/payments/stateMachine"
import { enqueueWebhookForPayment } from "~~/server/services/webhooks/enqueueWebhook"

const schema = z.object({
  receivedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  note: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const auth = await requireApiKeyAuth(event)
    requireScope(auth, "payments:create")

    if (!auth.merchantAccountId) {
      throw new AppError("FORBIDDEN", "API key is not bound to a merchant account", 403)
    }

    const publicId = getRouterParam(event, "publicId")!
    const body = schema.parse(await readBody(event))

    const intent = await prisma.paymentIntent.findUnique({
      where: { publicId },
    })

    if (!intent) throw new AppError("PAYMENT_NOT_FOUND", "Payment intent not found", 404)

    // Security: must belong to this merchant
    if (intent.merchantAccountId !== auth.merchantAccountId) {
      throw new AppError("FORBIDDEN", "Payment intent does not belong to this merchant", 403)
    }

    // Must be a CASH payment
    if (intent.paymentMethodType !== "CASH") {
      throw new AppError("INVALID_PAYMENT_METHOD", "This endpoint is only for CASH payments", 422)
    }

    // Idempotent — already confirmed
    if (intent.status === "SUCCEEDED") {
      return {
        publicId: intent.publicId,
        status: "SUCCEEDED",
        amount: intent.amount.toString(),
        receivedAmount: body.receivedAmount,
        alreadyConfirmed: true,
      }
    }

    // Only confirm from AWAITING_CUSTOMER
    if (intent.status !== "AWAITING_CUSTOMER") {
      throw new AppError(
        "INVALID_PAYMENT_STATUS",
        `Cannot confirm cash payment in status: ${intent.status}`,
        422,
      )
    }

    await applyPaymentTransition({
      paymentIntentId: intent.id,
      toStatus: "SUCCEEDED",
      eventType: "CASH_COLLECTED",
      summary: `Cash collected by KIOSK: ${body.receivedAmount} THB${body.note ? ` — ${body.note}` : ""}`,
      patch: {
        succeededAt: new Date(),
        extra: {
          receivedAmount: body.receivedAmount,
          collectedBy: "KIOSK",
          ...(body.note ? { note: body.note } : {}),
        },
      },
      payload: {
        receivedAmount: body.receivedAmount,
        expectedAmount: intent.amount.toString(),
        collectedBy: "KIOSK",
        ...(body.note ? { note: body.note } : {}),
      },
    })

    await enqueueWebhookForPayment(intent.id, "PAYMENT_SUCCEEDED")

    return {
      publicId: intent.publicId,
      status: "SUCCEEDED",
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
