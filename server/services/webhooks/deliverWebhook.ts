import { prisma } from "~~/server/lib/prisma";
import { webhookQueue } from "~~/server/lib/bullmq";
import {
  buildWebhookHeaders,
  PAYIQ_WEBHOOK_SIGNATURE_VERSION,
} from "./webhook-signer";

const RETRYABLE_HTTP_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_HTTP_STATUS = new Set([400, 401, 403, 404, 405, 410, 422]);

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60 * 1000;
const JITTER_RATIO = 0.2;

function normalizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of headers.entries()) {
    out[key] = value;
  }

  return out;
}

function computeNextDelayMs(attemptNumber: number): number {
  const exponent = Math.max(0, attemptNumber - 1);
  const base = Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
  const jitter = Math.floor(base * JITTER_RATIO * Math.random());
  return base + jitter;
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.message.toLowerCase().includes("timeout")
  );
}

function isRetryableError(error: unknown): boolean {
  if (isAbortLikeError(error)) return true;

  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();

  return (
    message.includes("unable to connect") ||
    message.includes("connection refused") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout")
  );
}

function shouldRetryHttpStatus(statusCode: number): boolean {
  if (RETRYABLE_HTTP_STATUS.has(statusCode)) return true;
  if (NON_RETRYABLE_HTTP_STATUS.has(statusCode)) return false;

  return statusCode >= 500;
}

function computeNextAttempt(attemptNumber: number): Date {
  return new Date(Date.now() + computeNextDelayMs(attemptNumber));
}

async function scheduleRetry(
  deliveryId: string,
  nextAttemptAt: Date,
): Promise<void> {
  await webhookQueue.add(
    "merchant.webhook.deliver",
    { webhookDeliveryId: deliveryId },
    {
      delay: Math.max(1000, nextAttemptAt.getTime() - Date.now()),
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  );
}

export async function deliverWebhook(webhookDeliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: webhookDeliveryId },
    include: { paymentIntent: true, webhookEndpoint: true },
  });

  if (!delivery) return;
  if (delivery.status === "DELIVERED" || delivery.status === "DEAD") return;

  const payload = JSON.stringify({
    id: delivery.id,
    eventType: delivery.eventType,
    createdAt: delivery.createdAt.toISOString(),
    payment: {
      publicId: delivery.paymentIntent.publicId,
      status: delivery.paymentIntent.status,
      amount: delivery.paymentIntent.amount.toString(),
      currency: delivery.paymentIntent.currency,
      merchantOrderId: delivery.paymentIntent.merchantOrderId,
      merchantReference: delivery.paymentIntent.merchantReference,
      providerReference: delivery.paymentIntent.providerReference,
      providerTransactionId: delivery.paymentIntent.providerTransactionId,
    },
  });

  const signingSecret =
    delivery.webhookEndpoint.secretEncrypted ||
    delivery.webhookEndpoint.secretHash ||
    "";

  const headers = buildWebhookHeaders({
    eventId: delivery.id,
    secret: signingSecret,
    rawBody: payload,
  });

  const currentAttemptNumber = delivery.attemptNumber + 1;
  const maxAttempts = delivery.webhookEndpoint.maxAttempts;

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PROCESSING",
      attemptNumber: { increment: 1 },
      targetUrlSnapshot: delivery.webhookEndpoint.url,
      timeoutMsSnapshot: delivery.webhookEndpoint.timeoutMs,
      signatureVersion: PAYIQ_WEBHOOK_SIGNATURE_VERSION,
      requestHeaders: headers as never,
      requestBody: JSON.parse(payload) as never,
      signature: headers["x-payiq-signature"],
      nextAttemptAt: null,
    },
  });

  try {
    const res = await fetch(delivery.webhookEndpoint.url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(delivery.webhookEndpoint.timeoutMs),
    });

    const text = await res.text();
    const responseHeaders = normalizeHeaders(res.headers);

    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          responseStatusCode: res.status,
          responseHeaders: responseHeaders as never,
          responseBody: text,
          errorMessage: null,
          lastErrorAt: null,
          nextAttemptAt: null,
        },
      });

      return;
    }

    const retryable = shouldRetryHttpStatus(res.status);
    const exhausted = currentAttemptNumber >= maxAttempts;

    if (!retryable || exhausted) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DEAD",
          responseStatusCode: res.status,
          responseHeaders: responseHeaders as never,
          responseBody: text,
          lastErrorAt: new Date(),
          errorMessage: `HTTP ${res.status}`,
          nextAttemptAt: null,
        },
      });

      return;
    }

    const nextAttemptAt = computeNextAttempt(currentAttemptNumber);

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "RETRYING",
        responseStatusCode: res.status,
        responseHeaders: responseHeaders as never,
        responseBody: text,
        lastErrorAt: new Date(),
        errorMessage: `HTTP ${res.status}`,
        nextAttemptAt,
      },
    });

    await scheduleRetry(delivery.id, nextAttemptAt);
  } catch (error: unknown) {
    const retryable = isRetryableError(error);
    const exhausted = currentAttemptNumber >= maxAttempts;
    const message =
      error instanceof Error ? error.message : "Webhook delivery failed";

    if (!retryable || exhausted) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "DEAD",
          lastErrorAt: new Date(),
          errorMessage: message,
          nextAttemptAt: null,
        },
      });

      return;
    }

    const nextAttemptAt = computeNextAttempt(currentAttemptNumber);

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "RETRYING",
        lastErrorAt: new Date(),
        errorMessage: message,
        nextAttemptAt,
      },
    });

    await scheduleRetry(delivery.id, nextAttemptAt);
  }
}
