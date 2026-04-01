import { prisma } from "~/server/lib/prisma";
import { applyPaymentTransition } from "~/server/services/payments/stateMachine";
import { enqueueWebhookForPayment } from "~/server/services/webhooks/enqueueWebhook";

type CallbackProcessStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | null;

type UnknownRecord = Record<string, unknown>;

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

function mergeCallbackSources(callback: Record<string, unknown>): unknown {
  const body = asRecord(
    callback.body ??
      callback.normalizedPayload ??
      callback.payload ??
      callback.normalized ??
      {},
  );

  const queryParams = asRecord(callback.queryParams);
  const queryNormalized = asRecord(queryParams?._normalized);
  const bodyNormalized = asRecord(body?._normalized);

  return {
    ...(body ?? {}),
    _normalized: {
      ...(bodyNormalized ?? {}),
      ...(queryNormalized ?? {}),
    },
  };
}

function extractNormalizedBody(body: unknown): {
  providerReference: string | null;
  providerTxnId: string | null;
  providerQrRef: string | null;
  externalStatus: string | null;
  normalizedStatus: CallbackProcessStatus;
  eventId: string | null;
  billPaymentRef1: string | null;
  billPaymentRef2: string | null;
  billPaymentRef3: string | null;
} {
  const bodyRecord = asRecord(body);
  const normalized = asRecord(bodyRecord?._normalized);
  const data = asRecord(bodyRecord?.data);

  const billPaymentRef1 = pickFirstString([
    normalized?.billPaymentRef1,
    bodyRecord?.billPaymentRef1,
    data?.billPaymentRef1,
  ]);

  const billPaymentRef2 = pickFirstString([
    normalized?.billPaymentRef2,
    bodyRecord?.billPaymentRef2,
    data?.billPaymentRef2,
  ]);

  const billPaymentRef3 = pickFirstString([
    normalized?.billPaymentRef3,
    bodyRecord?.billPaymentRef3,
    data?.billPaymentRef3,
  ]);

  const providerReference = pickFirstString([
    normalized?.providerReference,
    billPaymentRef1,
    bodyRecord?.partnerPaymentId,
    data?.partnerPaymentId,
  ]);

  const providerTxnId = pickFirstString([
    normalized?.providerTxnId,
    bodyRecord?.transactionId,
    data?.transactionId,
  ]);

  const providerQrRef = pickFirstString([
    normalized?.providerQrRef,
    normalized?.billPaymentRef3,
    bodyRecord?.billPaymentRef3,
    data?.billPaymentRef3,
  ]);

  const externalStatus = pickFirstString([
    normalized?.externalStatus,
    bodyRecord?.status,
    bodyRecord?.paymentStatus,
    data?.status,
    data?.paymentStatus,
  ]);

  const eventId = pickFirstString([
    normalized?.eventId,
    providerTxnId,
    providerReference,
    billPaymentRef3,
  ]);

  const normalizedStatusValue = normalized?.normalizedStatus;
  const normalizedStatus =
    normalizedStatusValue === "PENDING" ||
    normalizedStatusValue === "SUCCEEDED" ||
    normalizedStatusValue === "FAILED" ||
    normalizedStatusValue === "EXPIRED"
      ? normalizedStatusValue
      : providerTxnId && providerReference
        ? "SUCCEEDED"
        : null;

  return {
    providerReference,
    providerTxnId,
    providerQrRef,
    externalStatus,
    normalizedStatus,
    eventId,
    billPaymentRef1,
    billPaymentRef2,
    billPaymentRef3,
  };
}

function isTerminalPaymentStatus(status: string): boolean {
  return ["SUCCEEDED", "FAILED", "EXPIRED", "REFUNDED", "REVERSED"].includes(
    status,
  );
}

async function markProviderCallbackFailed(args: {
  callbackId: string;
  paymentIntentId?: string | null;
  message: string;
}) {
  await prisma.providerCallback.update({
    where: { id: args.callbackId },
    data: {
      ...(args.paymentIntentId
        ? { paymentIntentId: args.paymentIntentId }
        : {}),
      processStatus: "FAILED",
      failedAt: new Date(),
      errorMessage: args.message,
    },
  });
}

export async function processProviderCallback(providerCallbackId: string) {
  const callback = await prisma.providerCallback.findUnique({
    where: { id: providerCallbackId },
  });

  if (!callback) {
    return;
  }

  if (callback.processStatus === "PROCESSED" || callback.processedAt) {
    return {
      ok: true,
      skipped: true,
      reason: "already processed",
    };
  }

  if (callback.signatureValid === false) {
    await markProviderCallbackFailed({
      callbackId: callback.id,
      paymentIntentId: callback.paymentIntentId ?? null,
      message: "Invalid provider callback signature",
    });
    return;
  }

  await prisma.providerCallback.update({
    where: { id: callback.id },
    data: {
      processStatus: "PROCESSING",
      errorMessage: null,
    },
  });

  const callbackAny = callback as unknown as Record<string, unknown>;
  const callbackBody = mergeCallbackSources(callbackAny);

  const normalized = extractNormalizedBody(callbackBody);

  const providerTxnId = callback.providerTxnId || normalized.providerTxnId;

  const providerReference =
    callback.providerReference ||
    normalized.providerReference ||
    normalized.billPaymentRef1 ||
    normalized.billPaymentRef2;

  const orConditions: Array<Record<string, string>> = [];

  if (providerTxnId) {
    orConditions.push({ providerTransactionId: providerTxnId });
  }

  if (providerReference) {
    orConditions.push({ publicId: providerReference });
    orConditions.push({ providerReference });
    orConditions.push({ merchantReference: providerReference });
  }

  if (normalized.billPaymentRef1) {
    orConditions.push({ publicId: normalized.billPaymentRef1 });
    orConditions.push({ providerReference: normalized.billPaymentRef1 });
    orConditions.push({ merchantReference: normalized.billPaymentRef1 });
  }

  if (normalized.billPaymentRef2) {
    orConditions.push({ merchantOrderId: normalized.billPaymentRef2 });
    orConditions.push({ merchantReference: normalized.billPaymentRef2 });
  }

  if (normalized.providerQrRef) {
    orConditions.push({ providerQrRef: normalized.providerQrRef });
  }

  if (normalized.billPaymentRef3) {
    orConditions.push({ providerQrRef: normalized.billPaymentRef3 });
  }

  const payment =
    orConditions.length > 0
      ? await prisma.paymentIntent.findFirst({
          where: { OR: orConditions },
        })
      : null;

  if (!payment) {
    await markProviderCallbackFailed({
      callbackId: callback.id,
      message: "Payment intent not found for callback",
    });
    return;
  }

  const currentStatus = String(payment.status);
  const normalizedStatus = normalized.normalizedStatus;

  if (isTerminalPaymentStatus(currentStatus)) {
    await prisma.providerCallback.update({
      where: { id: callback.id },
      data: {
        paymentIntentId: payment.id,
        processStatus: "PROCESSED",
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      ok: true,
      skipped: true,
      reason: "payment already final",
    };
  }

  if (normalizedStatus === "PENDING") {
    await applyPaymentTransition({
      paymentIntentId: payment.id,
      toStatus: "PROCESSING",
      eventType: "PROVIDER_CALLBACK_RECEIVED",
      summary: "Provider callback received",
      allowedFrom: ["AWAITING_CUSTOMER", "PENDING_PROVIDER", "PROCESSING"],
      patch: {
        ...(providerReference ? { providerReference } : {}),
        ...(providerTxnId ? { providerTransactionId: providerTxnId } : {}),
        ...(normalized.providerQrRef
          ? { providerQrRef: normalized.providerQrRef }
          : {}),
      },
      payload: {
        callbackId: callback.id,
        providerCallbackId: callback.id,
        providerReference,
        providerTxnId,
        externalStatus: normalized.externalStatus,
        normalizedStatus,
        eventId: normalized.eventId,
        billPaymentRef1: normalized.billPaymentRef1,
        billPaymentRef2: normalized.billPaymentRef2,
        billPaymentRef3: normalized.billPaymentRef3,
        body: callbackBody,
      },
    });
  } else if (
    normalizedStatus === "SUCCEEDED" ||
    normalizedStatus === "FAILED" ||
    normalizedStatus === "EXPIRED"
  ) {
    const eventType =
      normalizedStatus === "SUCCEEDED"
        ? "PAYMENT_SUCCEEDED"
        : normalizedStatus === "FAILED"
          ? "PAYMENT_FAILED"
          : "PAYMENT_EXPIRED";

    const summary =
      normalizedStatus === "SUCCEEDED"
        ? "Payment marked successful from provider callback"
        : normalizedStatus === "FAILED"
          ? "Payment marked failed from provider callback"
          : "Payment marked expired from provider callback";

    await applyPaymentTransition({
      paymentIntentId: payment.id,
      toStatus: normalizedStatus,
      eventType,
      summary,
      allowedFrom: [
        "CREATED",
        "ROUTING",
        "PENDING_PROVIDER",
        "AWAITING_CUSTOMER",
        "PROCESSING",
      ],
      patch: {
        ...(providerReference ? { providerReference } : {}),
        ...(providerTxnId ? { providerTransactionId: providerTxnId } : {}),
        ...(normalized.providerQrRef
          ? { providerQrRef: normalized.providerQrRef }
          : {}),
        ...(normalizedStatus === "SUCCEEDED"
          ? { succeededAt: new Date() }
          : {}),
        ...(normalizedStatus === "FAILED" ? { failedAt: new Date() } : {}),
        ...(normalizedStatus === "EXPIRED" ? { expiredAt: new Date() } : {}),
      },
      payload: {
        callbackId: callback.id,
        providerCallbackId: callback.id,
        providerReference,
        providerTxnId,
        externalStatus: normalized.externalStatus,
        normalizedStatus,
        eventId: normalized.eventId,
        billPaymentRef1: normalized.billPaymentRef1,
        billPaymentRef2: normalized.billPaymentRef2,
        billPaymentRef3: normalized.billPaymentRef3,
        body: callbackBody,
      },
    });

    await enqueueWebhookForPayment(payment.id, eventType);
  } else {
    await markProviderCallbackFailed({
      callbackId: callback.id,
      paymentIntentId: payment.id,
      message: "Unable to determine callback status",
    });
    return;
  }

  await prisma.providerCallback.update({
    where: { id: callback.id },
    data: {
      paymentIntentId: payment.id,
      processStatus: "PROCESSED",
      processedAt: new Date(),
      errorMessage: null,
    },
  });

  return {
    ok: true,
  };
}
