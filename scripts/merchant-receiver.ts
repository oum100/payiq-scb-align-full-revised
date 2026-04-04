import crypto from "node:crypto";
import { redis } from "../server/lib/redis";
import { hmacSha256 } from "../server/lib/crypto";

type PayIQWebhookEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  payment: {
    publicId: string;
    status: string;
    amount: string;
    currency: string;
    merchantOrderId: string | null;
    merchantReference: string | null;
    providerReference: string | null;
    providerTransactionId: string | null;
  };
};

type StoredWebhookEvent = {
  eventId: string;
  receivedAt: string;
  processedAt: string | null;
  duplicate: boolean;
  headers: Record<string, string>;
  payload: PayIQWebhookEvent | null;
  rawBody: string;
};

const PORT = Number(process.env.MERCHANT_WEBHOOK_PORT ?? 3001);
const WEBHOOK_SECRET =
  process.env.PAYIQ_WEBHOOK_SECRET ?? "merchant-webhook-secret";

const TIMESTAMP_TOLERANCE_SEC = Number(
  process.env.MERCHANT_WEBHOOK_TIMESTAMP_TOLERANCE_SEC ?? 300,
);

const PROCESSING_LOCK_TTL_SEC = Number(
  process.env.MERCHANT_WEBHOOK_PROCESSING_TTL_SEC ?? 120,
);

const COMPLETED_TTL_SEC = Number(
  process.env.MERCHANT_WEBHOOK_IDEMPOTENCY_TTL_SEC ?? 24 * 60 * 60,
);

const EVENT_RETENTION_SEC = Number(
  process.env.MERCHANT_WEBHOOK_EVENT_RETENTION_SEC ?? 7 * 24 * 60 * 60,
);

const EVENT_LIST_KEY = "merchant:webhook:events";
const MAX_EVENT_LIST_SIZE = Number(
  process.env.MERCHANT_WEBHOOK_MAX_EVENT_LIST_SIZE ?? 200,
);

function buildSigningPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

function computeSignature(timestamp: string, rawBody: string): string {
  return hmacSha256(WEBHOOK_SECRET, buildSigningPayload(timestamp, rawBody));
}

function secureEqualHex(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");

  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isTimestampWithinTolerance(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= TIMESTAMP_TOLERANCE_SEC;
}

function getCompletedKey(eventId: string): string {
  return `merchant:webhook:completed:${eventId}`;
}

function getProcessingKey(eventId: string): string {
  return `merchant:webhook:processing:${eventId}`;
}

function getEventKey(eventId: string): string {
  return `merchant:webhook:event:${eventId}`;
}

function normalizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    out[key] = value;
  }
  return out;
}

async function isAlreadyCompleted(eventId: string): Promise<boolean> {
  const value = await redis.get(getCompletedKey(eventId));
  return value === "1";
}

async function tryAcquireProcessingLock(eventId: string): Promise<boolean> {
  const result = await redis.set(
    getProcessingKey(eventId),
    "1",
    "EX",
    PROCESSING_LOCK_TTL_SEC,
    "NX",
  );

  return result === "OK";
}

async function markCompleted(eventId: string): Promise<void> {
  await redis.set(getCompletedKey(eventId), "1", "EX", COMPLETED_TTL_SEC);
  await redis.del(getProcessingKey(eventId));
}

async function releaseProcessingLock(eventId: string): Promise<void> {
  await redis.del(getProcessingKey(eventId));
}

async function storeEvent(record: StoredWebhookEvent): Promise<void> {
  const key = getEventKey(record.eventId);
  await redis.set(key, JSON.stringify(record), "EX", EVENT_RETENTION_SEC);
  await redis.lpush(EVENT_LIST_KEY, record.eventId);
  await redis.ltrim(EVENT_LIST_KEY, 0, Math.max(0, MAX_EVENT_LIST_SIZE - 1));
}

async function loadEvent(eventId: string): Promise<StoredWebhookEvent | null> {
  const raw = await redis.get(getEventKey(eventId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredWebhookEvent;
  } catch {
    return null;
  }
}

async function loadRecentEvents(limit: number): Promise<StoredWebhookEvent[]> {
  const safeLimit = Math.max(1, Math.min(limit, MAX_EVENT_LIST_SIZE));
  const ids = await redis.lrange(EVENT_LIST_KEY, 0, safeLimit - 1);

  const results: StoredWebhookEvent[] = [];
  for (const id of ids) {
    const item = await loadEvent(id);
    if (item) results.push(item);
  }

  return results;
}

async function processMerchantBusinessLogic(
  payload: PayIQWebhookEvent,
): Promise<void> {
  // Replace this with real merchant-side business logic.
  // Examples:
  // - mark order as PAID in merchant DB
  // - unlock service / machine
  // - emit internal event
  // - notify UI / customer

  console.log("\n✅ VERIFIED WEBHOOK v1");
  console.log({
    eventId: payload.id,
    eventType: payload.eventType,
    merchantReference: payload.payment.merchantReference,
    publicId: payload.payment.publicId,
    providerReference: payload.payment.providerReference,
    providerTransactionId: payload.payment.providerTransactionId,
    status: payload.payment.status,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "merchant-receiver",
        port: PORT,
        now: new Date().toISOString(),
      });
    }

    if (req.method === "GET" && url.pathname === "/events") {
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const events = await loadRecentEvents(limit);

      return jsonResponse({
        ok: true,
        count: events.length,
        events,
      });
    }

    if (req.method === "GET" && url.pathname.startsWith("/events/")) {
      const eventId = url.pathname.slice("/events/".length);
      if (!eventId) {
        return jsonResponse({ error: "missing event id" }, 400);
      }

      const event = await loadEvent(eventId);
      if (!event) {
        return jsonResponse({ error: "event not found" }, 404);
      }

      return jsonResponse({
        ok: true,
        event,
      });
    }

    if (req.method !== "POST" || url.pathname !== "/payiq/webhook") {
      return jsonResponse({ error: "not found" }, 404);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-payiq-signature") ?? "";
    const timestamp = req.headers.get("x-payiq-timestamp") ?? "";
    const eventId = req.headers.get("x-payiq-event-id") ?? "";
    const version = req.headers.get("x-payiq-signature-version") ?? "";
    const headers = normalizeHeaders(req.headers);

    if (!signature) {
      return jsonResponse({ error: "missing signature" }, 400);
    }

    if (!timestamp) {
      return jsonResponse({ error: "missing timestamp" }, 400);
    }

    if (!eventId) {
      return jsonResponse({ error: "missing event id" }, 400);
    }

    if (version !== "v1") {
      return jsonResponse({ error: "unsupported signature version" }, 400);
    }

    if (!isTimestampWithinTolerance(timestamp)) {
      return jsonResponse({ error: "timestamp outside tolerance" }, 400);
    }

    const expected = computeSignature(timestamp, rawBody);

    if (!secureEqualHex(signature, expected)) {
      return jsonResponse({ error: "invalid signature" }, 400);
    }

    if (await isAlreadyCompleted(eventId)) {
      await storeEvent({
        eventId,
        receivedAt: new Date().toISOString(),
        processedAt: null,
        duplicate: true,
        headers,
        payload: null,
        rawBody,
      });

      return jsonResponse({ ok: true, duplicate: true }, 200);
    }

    const lockAcquired = await tryAcquireProcessingLock(eventId);

    if (!lockAcquired) {
      return jsonResponse(
        {
          ok: false,
          code: "EVENT_IN_PROGRESS",
          message: "Webhook event is already being processed",
        },
        409,
      );
    }

    try {
      let payload: PayIQWebhookEvent;

      try {
        payload = JSON.parse(rawBody) as PayIQWebhookEvent;
      } catch {
        await releaseProcessingLock(eventId);
        return jsonResponse({ error: "invalid json" }, 400);
      }

      if (!payload?.id || !payload?.eventType || !payload?.payment?.publicId) {
        await releaseProcessingLock(eventId);
        return jsonResponse({ error: "invalid payload shape" }, 400);
      }

      await processMerchantBusinessLogic(payload);
      await markCompleted(eventId);

      await storeEvent({
        eventId,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        duplicate: false,
        headers,
        payload,
        rawBody,
      });

      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      await releaseProcessingLock(eventId);

      console.error("[merchant-receiver] processing failed", {
        eventId,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : String(error),
      });

      return jsonResponse(
        {
          ok: false,
          error: "processing failed",
        },
        500,
      );
    }
  },
});

console.log(
  `🚀 Merchant receiver running at http://127.0.0.1:${PORT}/payiq/webhook`,
);
console.log(
  JSON.stringify(
    {
      port: PORT,
      timestampToleranceSec: TIMESTAMP_TOLERANCE_SEC,
      processingLockTtlSec: PROCESSING_LOCK_TTL_SEC,
      completedTtlSec: COMPLETED_TTL_SEC,
      eventRetentionSec: EVENT_RETENTION_SEC,
      maxEventListSize: MAX_EVENT_LIST_SIZE,
      healthUrl: `http://127.0.0.1:${PORT}/health`,
      eventsUrl: `http://127.0.0.1:${PORT}/events`,
    },
    null,
    2,
  ),
);