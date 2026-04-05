import { storeProviderCallback } from "~~/server/services/callbacks/storeProviderCallback";
import { normalizeScbCallback } from "~~/server/services/providers/scb/scb.webhook";

function buildAck(transactionId: string, confirmId?: string) {
  return {
    resCode: "00",
    resDesc: "success",
    transactionId,
    ...(confirmId ? { confirmId } : {}),
  };
}

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event, "utf8")) || "{}";
  const headers = getHeaders(event);
  const normalized = normalizeScbCallback({
    rawBody,
    headers,
  });

  const transactionId = normalized.providerTxnId || "UNKNOWN";

  await storeProviderCallback({
    providerCode: "SCB",
    rawBody,
    body: normalized.enrichedBody,
    headers,
    queryParams: {
      ...(getQuery(event) as Record<string, unknown>),
      _normalized: {
        externalStatus: normalized.externalStatus,
        normalizedStatus: normalized.normalizedStatus,
        eventId: normalized.eventId,

        providerReference: normalized.providerReference,
        providerTxnId: normalized.providerTxnId,
        providerQrRef: normalized.providerQrRef,

        billPaymentRef1: normalized.billPaymentRef1,
        billPaymentRef2: normalized.billPaymentRef2,
        billPaymentRef3: normalized.billPaymentRef3,
      },
    },
    signatureValid: null,
    providerReference: normalized.providerReference,
    providerTxnId: normalized.providerTxnId,
  });

  return buildAck(transactionId);
});
