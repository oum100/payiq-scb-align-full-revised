import { hmacSha256 } from "~/server/lib/crypto"

export const PAYIQ_WEBHOOK_SIGNATURE_VERSION = "v1"

export function buildWebhookSigningPayload(timestamp: string, rawBody: string) {
  return `${timestamp}.${rawBody}`
}

export function signWebhookPayload(
  secret: string,
  timestamp: string,
  rawBody: string,
) {
  return hmacSha256(secret, buildWebhookSigningPayload(timestamp, rawBody))
}

export function buildWebhookHeaders(args: {
  eventId: string
  secret: string
  rawBody: string
  timestamp?: string
}) {
  const timestamp = args.timestamp ?? String(Math.floor(Date.now() / 1000))
  const signature = signWebhookPayload(args.secret, timestamp, args.rawBody)

  return {
    "content-type": "application/json",
    "x-payiq-event-id": args.eventId,
    "x-payiq-timestamp": timestamp,
    "x-payiq-signature": signature,
    "x-payiq-signature-version": PAYIQ_WEBHOOK_SIGNATURE_VERSION,
  }
}