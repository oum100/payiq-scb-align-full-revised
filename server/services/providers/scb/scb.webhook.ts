import { mapScbStatusToInternal } from "./scb.mapper";

type UnknownRecord = Record<string, unknown>;

export type NormalizedScbCallback = {
  body: unknown;
  enrichedBody: unknown;
  providerReference: string | null;
  providerTxnId: string | null;
  providerQrRef: string | null;
  billPaymentRef1: string | null;
  billPaymentRef2: string | null;
  billPaymentRef3: string | null;
  externalStatus: string | null;
  normalizedStatus: "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | null;
  eventId: string | null;
  signatureHeader: string;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseJsonBody(rawBody: string): unknown {
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return {
      _rawBody: rawBody,
      _invalidJson: true,
    };
  }
}

export function extractScbSignatureHeader(
  headers: Record<string, unknown>,
): string {
  return (
    pickFirstString([
      headers["x-signature"],
      headers["X-Signature"],
      headers.authorization,
      headers.Authorization,
    ]) || ""
  );
}

export function normalizeScbCallback(args: {
  rawBody: string;
  headers: Record<string, unknown>;
}): NormalizedScbCallback {
  const parsedBody = parseJsonBody(args.rawBody);
  const bodyRecord = asRecord(parsedBody);
  const dataRecord = asRecord(bodyRecord?.data);

  const billPaymentRef1 = pickFirstString([
    bodyRecord?.billPaymentRef1,
    dataRecord?.billPaymentRef1,
    bodyRecord?.partnerPaymentId,
    bodyRecord?.partnerPaymentID,
    dataRecord?.partnerPaymentId,
    dataRecord?.partnerPaymentID,
  ]);

  const billPaymentRef2 = pickFirstString([
    bodyRecord?.billPaymentRef2,
    dataRecord?.billPaymentRef2,
  ]);

  const billPaymentRef3 = pickFirstString([
    bodyRecord?.billPaymentRef3,
    dataRecord?.billPaymentRef3,
  ]);

  const providerReference = billPaymentRef1;

  const providerTxnId = pickFirstString([
    bodyRecord?.transactionId,
    bodyRecord?.transactionID,
    bodyRecord?.txnId,
    dataRecord?.transactionId,
    dataRecord?.transactionID,
    dataRecord?.txnId,
  ]);

  const providerQrRef = billPaymentRef3;

  const statusLikeValue = pickFirstString([
    bodyRecord?.status,
    bodyRecord?.paymentStatus,
    bodyRecord?.statusText,
    dataRecord?.status,
    dataRecord?.paymentStatus,
    dataRecord?.statusText,
  ]);

  const externalStatus = pickFirstString([
    statusLikeValue,
    bodyRecord?.transactionType,
    dataRecord?.transactionType,
  ]);

  const normalizedStatus =
    statusLikeValue
      ? mapScbStatusToInternal(statusLikeValue)
      : providerTxnId && providerReference
        ? "SUCCEEDED"
        : null;

  const eventId = pickFirstString([
    args.headers["x-event-id"],
    args.headers["X-Event-Id"],
    args.headers["x-correlation-id"],
    args.headers["X-Correlation-Id"],
    bodyRecord?.eventId,
    bodyRecord?.eventID,
    dataRecord?.eventId,
    dataRecord?.eventID,
    providerTxnId,
    providerReference,
    providerQrRef,
  ]);

  const signatureHeader = extractScbSignatureHeader(args.headers);

  const normalizedPayload = {
    providerReference,
    providerTxnId,
    providerQrRef,
    billPaymentRef1,
    billPaymentRef2,
    billPaymentRef3,
    externalStatus,
    normalizedStatus,
    eventId,
    signatureHeaderPresent: Boolean(signatureHeader),
  };

  const enrichedBody =
    bodyRecord !== null
      ? {
          ...bodyRecord,
          _normalized: normalizedPayload,
        }
      : {
          originalBody: parsedBody,
          _normalized: normalizedPayload,
        };

  return {
    body: parsedBody,
    enrichedBody,
    providerReference,
    providerTxnId,
    providerQrRef,
    billPaymentRef1,
    billPaymentRef2,
    billPaymentRef3,
    externalStatus,
    normalizedStatus,
    eventId,
    signatureHeader,
  };
}