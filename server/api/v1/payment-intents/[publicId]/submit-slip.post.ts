import { z } from "zod"
import { submitSlip } from "~~/server/services/payments/submitSlip"
import { AppError } from "~~/server/lib/errors"
import { requireApiKeyAuth } from "~~/server/lib/auth"
import { requireScope } from "~~/server/services/auth/requireScope"

/**
 * POST /api/v1/payment-intents/:publicId/submit-slip
 *
 * Accepts three input methods (mutually exclusive):
 *   1. { method: "qr",   qrData: "<QR string from slip>" }
 *   2. { method: "file", imageBase64: "<base64 encoded image>", mimeType: "image/jpeg" }
 *   3. { method: "url",  imageUrl: "<https://...>" }
 *
 * Returns:
 *   { publicId, status, transRef, senderName, receiverName, verifiedAmount }
 */

const schema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("qr"),
    qrData: z.string().min(1),
  }),
  z.object({
    method: z.literal("file"),
    imageBase64: z.string().min(1),
    mimeType: z.string().default("image/jpeg"),
  }),
  z.object({
    method: z.literal("url"),
    imageUrl: z.string().url(),
  }),
])

export default defineEventHandler(async (event) => {
  try {
    const auth = await requireApiKeyAuth(event)
    requireScope(auth, "payments:create")

    const publicId = getRouterParam(event, "publicId")
    if (!publicId) {
      setResponseStatus(event, 400)
      return { error: "BAD_REQUEST", message: "publicId is required" }
    }

    const body = schema.parse(await readBody(event))

    let input: Parameters<typeof submitSlip>[1]

    if (body.method === "qr") {
      input = { method: "qr", qrData: body.qrData }
    } else if (body.method === "file") {
      const imageData = Buffer.from(body.imageBase64, "base64")
      input = { method: "file", imageData, mimeType: body.mimeType }
    } else {
      input = { method: "url", imageUrl: body.imageUrl }
    }

    const result = await submitSlip(publicId, input)
    return result
  } catch (error: any) {
    if (error instanceof AppError) {
      setResponseStatus(event, error.statusCode)
      return {
        error: error.code,
        message: error.message,
        details: error.details,
      }
    }

    if (error?.statusCode) {
      setResponseStatus(event, error.statusCode)
      return {
        error: error?.data?.code || "REQUEST_ERROR",
        message: error?.statusMessage || error?.message || "Request failed",
      }
    }

    setResponseStatus(event, 400)
    return {
      error: "BAD_REQUEST",
      message: error?.message || "Invalid request",
    }
  }
})
