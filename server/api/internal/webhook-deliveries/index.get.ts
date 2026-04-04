import { defineEventHandler, getQuery } from "h3";
import { prisma } from "~/server/lib/prisma";

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPositiveInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const page = toPositiveInt(query.page, 1, 1, 100000);
  const pageSize = toPositiveInt(query.pageSize, 20, 1, 100);

  const status = toStringOrNull(query.status);
  const eventType = toStringOrNull(query.eventType);
  const merchantReference = toStringOrNull(query.merchantReference);
  const publicId = toStringOrNull(query.publicId);

  const rows = await prisma.webhookDelivery.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      paymentIntent: {
        select: {
          publicId: true,
          merchantReference: true,
          merchantOrderId: true,
          status: true,
          providerReference: true,
          providerTransactionId: true,
        },
      },
      webhookEndpoint: {
        select: {
          id: true,
          code: true,
          url: true,
          maxAttempts: true,
          timeoutMs: true,
          status: true,
        },
      },
    },
  });

  const filtered = rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (eventType && row.eventType !== eventType) return false;

    if (
      merchantReference &&
      !String(row.paymentIntent?.merchantReference ?? "")
        .toLowerCase()
        .includes(merchantReference.toLowerCase())
    ) {
      return false;
    }

    if (
      publicId &&
      !String(row.paymentIntent?.publicId ?? "")
        .toLowerCase()
        .includes(publicId.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    filtersApplied: {
      status,
      eventType,
      merchantReference,
      publicId,
    },
  };
});