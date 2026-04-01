import { nanoid } from "nanoid";
import { prisma } from "~/server/lib/prisma";
import { callbackQueue } from "~/server/lib/bullmq";
import { sha256 } from "~/server/lib/crypto";
import type { ProviderCode } from "@prisma/client";

export async function storeProviderCallback(params: {
  providerCode: ProviderCode;
  rawBody: string;
  body: unknown;
  headers: Record<string, unknown>;
  queryParams?: Record<string, unknown>;
  signatureValid?: boolean | null;
  providerReference?: string | null;
  providerTxnId?: string | null;
  dedupeKey?: string | null;
  callbackType?: string | null;
  workerName?: string | null;
}) {
  const dedupeKey = params.dedupeKey ?? [
    params.providerCode,
    params.providerTxnId ?? "NO_TXN",
    params.providerReference ?? "NO_REF",
    sha256(params.rawBody),
  ].join(":");

  let callback;
  try {
    callback = await prisma.providerCallback.create({
      data: {
        providerCode: params.providerCode,
        callbackType: params.callbackType ?? "PAYMENT_CALLBACK",
        processStatus: params.signatureValid === false ? "FAILED" : "RECEIVED",
        providerReference: params.providerReference ?? null,
        providerTxnId: params.providerTxnId ?? null,
        signatureValid: params.signatureValid ?? null,
        dedupeKey,
        headers: params.headers as any,
        queryParams: (params.queryParams ?? {}) as any,
        body: params.body as any,
        rawBodySha256: sha256(params.rawBody),
        ...(params.signatureValid === false ? { failedAt: new Date(), errorMessage: "Invalid webhook signature" } : {}),
        ...(params.workerName ? { workerName: params.workerName } : {}),
      },
    });
  } catch {
    return { duplicate: true };
  }

  if (params.signatureValid === false) {
    return { duplicate: false, callbackId: callback.id, queued: false };
  }

  await callbackQueue.add(
    "provider.callback.process",
    { providerCallbackId: callback.id },
    {
      jobId: `pcb_${callback.id}_${nanoid(6)}`,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    },
  );

  await prisma.providerCallback.update({
    where: { id: callback.id },
    data: { processStatus: "QUEUED", queuedAt: new Date() },
  });

  return { duplicate: false, callbackId: callback.id, queued: true };
}
