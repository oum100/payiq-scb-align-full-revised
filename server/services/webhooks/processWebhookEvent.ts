import { prisma } from "~~/server/lib/prisma";
import { processProviderCallback } from "~~/server/services/callbacks/processProviderCallback";

export async function processWebhookEvent(providerCallbackId: string) {
  const callback = await prisma.providerCallback.findUnique({ where: { id: providerCallbackId } });
  if (!callback) throw new Error("provider callback not found");

  const providerValue = String((callback as any).providerCode ?? (callback as any).provider ?? "").toLowerCase();
  const result = await processProviderCallback(providerCallbackId);

  return {
    ...((result as Record<string, unknown>) ?? {}),
    ok: true,
    provider: providerValue,
    externalRef: (callback as any).providerTxnId ?? (callback as any).providerReference ?? null,
  };
}
