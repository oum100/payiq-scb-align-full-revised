import crypto from "node:crypto";

export const PAYIQ_WEBHOOK_SIGNATURE_VERSION = "v1";

export function buildWebhookSigningPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function signWebhookPayload(args: {
  secret: string;
  timestamp: string;
  rawBody: string;
}): string {
  const payload = buildWebhookSigningPayload(args.timestamp, args.rawBody);

  return crypto
    .createHmac("sha256", args.secret)
    .update(payload)
    .digest("hex");
}

export function secureCompareHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");

  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function buildWebhookHeaders(args: {
  eventId: string;
  secret: string;
  rawBody: string;
  timestamp?: string;
  contentType?: string;
}): Record<string, string> {
  const timestamp = args.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = signWebhookPayload({
    secret: args.secret,
    timestamp,
    rawBody: args.rawBody,
  });

  return {
    "content-type": args.contentType ?? "application/json",
    "x-payiq-event-id": args.eventId,
    "x-payiq-timestamp": timestamp,
    "x-payiq-signature": signature,
    "x-payiq-signature-version": PAYIQ_WEBHOOK_SIGNATURE_VERSION,
  };
}