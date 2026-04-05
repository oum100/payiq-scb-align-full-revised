import {
  defineEventHandler,
  getHeader,
  getHeaders,
  getQuery,
  getRequestIP,
  readRawBody,
  setResponseStatus,
} from "h3";
import { logEvent } from "~~/server/lib/observability";
import { verifyWebhookSignature } from "~~/server/utils/webhook/verify";
import { redis } from "~~/server/lib/redis";
import { prisma } from "~~/server/lib/prisma";
import { setEventRequestContext } from "~~/server/lib/request-context";
import { storeProviderCallback } from "~~/server/services/callbacks/storeProviderCallback";

function getAllowedIps(): string[] {
  return (process.env.WEBHOOK_IP_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}
function assertIpAllowed(event: any) {
  const allowedIps = getAllowedIps();
  if (!allowedIps.length) return;
  const requestIp = normalizeIp(getRequestIP(event, { xForwardedFor: true }));
  if (!requestIp || !allowedIps.includes(requestIp))
    throw new Error("ip not allowed");
}
function getWebhookRateLimit(): number {
  const raw = Number(process.env.WEBHOOK_RATE_LIMIT || 100);
  return !Number.isFinite(raw) || raw <= 0 ? 100 : Math.floor(raw);
}
async function assertWebhookRateLimit(event: any, provider: string) {
  const limit = getWebhookRateLimit();
  const requestIp =
    normalizeIp(getRequestIP(event, { xForwardedFor: true })) || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const key = `ratelimit:webhook:${provider}:${requestIp}:${Math.floor(now / windowMs)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, windowMs);
  if (count > limit) {
    const ttlMs = await redis.pttl(key);
    const retryAfterSec = ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : 60;
    const error = new Error("rate limit exceeded") as Error & {
      retryAfterSec?: number;
    };
    error.retryAfterSec = retryAfterSec;
    throw error;
  }
}
function normalizeProviderCode(provider: string) {
  const normalized = provider.toUpperCase();
  if (normalized !== "SCB" && normalized !== "KBANK")
    throw new Error("unsupported provider");
  return normalized as "SCB" | "KBANK";
}

export default defineEventHandler(async (event) => {
  const provider = String(event.context.params?.provider || "").trim();
  if (!provider) {
    setResponseStatus(event, 400);
    return { error: "missing provider" };
  }

  const providerCode = normalizeProviderCode(provider);
  const rawBody = (await readRawBody(event, "utf8")) || "";
  const signature = getHeader(event, "x-payiq-signature") || "";
  const timestamp = getHeader(event, "x-payiq-timestamp") || "";
  const eventId = getHeader(event, "x-payiq-event-id") || "";
  const merchantId = getHeader(event, "x-merchant-id") || null;
  const requestIp = normalizeIp(getRequestIP(event, { xForwardedFor: true }));

  setEventRequestContext(event, { provider: providerCode });
  logEvent({
    event: "webhook.inbound.received",
    data: {
      provider: providerCode,
      eventId,
      merchantId,
      requestIp,
      payloadSize: Buffer.byteLength(rawBody, "utf8"),
    },
  });

  if (!eventId) {
    setResponseStatus(event, 400);
    return { error: "missing event id" };
  }

  try {
    assertIpAllowed(event);
    await assertWebhookRateLimit(event, provider);
    await verifyWebhookSignature({
      rawBody,
      signature,
      timestamp,
      ...(merchantId ? { merchantId } : {}),
    });
  } catch (error: any) {
    const stored = await storeProviderCallback({
      providerCode,
      rawBody,
      body: (() => {
        try {
          return JSON.parse(rawBody || "{}");
        } catch {
          return { _raw: rawBody, _invalidJson: true };
        }
      })(),
      headers: getHeaders(event),
      queryParams: {
        ...(getQuery(event) as Record<string, unknown>),
        _meta: { eventId, merchantId, requestIp, provider: providerCode },
      },
      signatureValid: false,
      dedupeKey: `${providerCode}:EVENT:${eventId}`,
      callbackType: "GENERIC_WEBHOOK",
    });
    setEventRequestContext(event, {
      providerCallbackId: (stored as any).callbackId,
    });
    setResponseStatus(event, 400);
    return { error: error?.message || "invalid webhook" };
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return { _raw: rawBody, _invalidJson: true };
    }
  })();
  const stored = await storeProviderCallback({
    providerCode,
    rawBody,
    body,
    headers: getHeaders(event),
    queryParams: {
      ...(getQuery(event) as Record<string, unknown>),
      _meta: { eventId, merchantId, requestIp, provider: providerCode },
    },
    signatureValid: true,
    dedupeKey: `${providerCode}:EVENT:${eventId}`,
    callbackType: "GENERIC_WEBHOOK",
  });

  setEventRequestContext(event, {
    providerCallbackId: (stored as any).callbackId,
  });

  if ((stored as any).duplicate) {
    setResponseStatus(event, 200);
    return { ok: true, duplicate: true };
  }

  return { ok: true, providerCallbackId: (stored as any).callbackId ?? null };
});
