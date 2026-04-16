import { nanoid } from "nanoid"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"
import { applyPaymentTransition } from "./stateMachine"
import { enqueueWebhookForPayment } from "../webhooks/enqueueWebhook"
import { getThaiQrFullConfig } from "../providers/thai-qr/thai-qr.config"
import type { SlipVerifierType } from "../providers/thai-qr/thai-qr.config"

// SlipOK client
import { verifySlipByQr as slipokVerifyQr, verifySlipByFile as slipokVerifyFile } from "../providers/slipok/slipok.client"
import type { SlipOkConfig } from "../providers/slipok/slipok.config"
import { isSlipOkMockMode } from "../providers/slipok/slipok.config"

// Slip2Go client
import { verifySlip2GoByQr, verifySlip2GoByFile } from "../providers/slip2go/slip2go.client"
import type { Slip2GoConfig } from "../providers/slip2go/slip2go.config"
import { isSlip2GoMockMode } from "../providers/slip2go/slip2go.config"
import type { Slip2GoCheckCondition, Slip2GoData } from "../providers/slip2go/slip2go.types"

// ─────────────────────────────────────────────────────────────────────────────

/** Providers that support slip-based verification flow */
const SLIP_BASED_PROVIDERS = new Set(["THAI_QR", "SLIPOK", "SLIP2GO"])

export type SubmitSlipInput =
  | { method: "qr"; qrData: string }
  | { method: "file"; imageData: Buffer; mimeType: string }
  | { method: "url"; imageUrl: string }

export type SubmitSlipResult = {
  publicId: string
  status: string
  transRef?: string | null
  senderName?: string | null
  receiverName?: string | null
  verifiedAmount?: number | null
}

type VerifyOutcome =
  | { success: true; transRef: string; senderName?: string; receiverName?: string; amount: number; verifierCode: SlipVerifierType; rawRequest: unknown; rawResponse: unknown; httpStatus: number }
  | { success: false; code: string | number; message: string; retryable: boolean; verifierCode: SlipVerifierType | "NONE"; rawRequest: unknown; rawResponse: unknown; httpStatus: number }

// ─────────────────────────────────────────────────────────────────────────────

export async function submitSlip(
  publicId: string,
  input: SubmitSlipInput,
): Promise<SubmitSlipResult> {
  const payment = await prisma.paymentIntent.findUnique({
    where: { publicId },
    include: { billerProfile: true },
  })

  if (!payment) throw new AppError("PAYMENT_NOT_FOUND", "Payment not found", 404)

  if (!payment.providerCode || !SLIP_BASED_PROVIDERS.has(payment.providerCode)) {
    throw new AppError(
      "INVALID_METHOD",
      `Payment provider "${payment.providerCode}" does not support slip verification`,
      422,
    )
  }

  if (payment.status !== "AWAITING_CUSTOMER") {
    throw new AppError(
      "INVALID_STATUS",
      `Cannot submit slip for payment in status: ${payment.status}`,
      422,
    )
  }

  if (!payment.billerProfile) {
    throw new AppError("CONFIG_ERROR", "No biller profile attached to payment", 500)
  }

  // ── Resolve URL → file ───────────────────────────────────────────────────
  let resolvedInput: Exclude<SubmitSlipInput, { method: "url" }> =
    input as Exclude<SubmitSlipInput, { method: "url" }>

  if (input.method === "url") {
    const imgRes = await fetch(input.imageUrl)
    if (!imgRes.ok) throw new AppError("IMAGE_FETCH_ERROR", "Could not download slip image", 422)
    resolvedInput = {
      method: "file",
      imageData: Buffer.from(await imgRes.arrayBuffer()),
      mimeType: imgRes.headers.get("content-type") ?? "image/jpeg",
    }
  }

  // ── Read full config (QR + verifier) from BillerProfile ──────────────────
  const fullConfig = getThaiQrFullConfig(payment.billerProfile)
  const { slipVerifier, mock } = fullConfig
  const expectedAmount = Number(payment.amount)

  // Transition → PROCESSING
  await applyPaymentTransition({
    paymentIntentId: payment.id,
    toStatus: "PROCESSING",
    eventType: "SLIP_SUBMITTED",
    summary: "Customer submitted a bank transfer slip for verification",
    payload: {
      method: input.method,
      verifier: slipVerifier ?? "NONE",
    },
  })

  // ── Verify ────────────────────────────────────────────────────────────────
  let outcome: VerifyOutcome

  const isMock =
    mock ||
    (slipVerifier === "SLIP2GO" && isSlip2GoMockMode(payment.billerProfile)) ||
    (slipVerifier === "SLIPOK"  && isSlipOkMockMode(payment.billerProfile))

  if (isMock) {
    // Mock mode: always succeed without hitting any external API
    outcome = {
      success: true,
      transRef: `MOCK_${nanoid(12)}`,
      senderName: "Mock Sender",
      receiverName: "Mock Receiver",
      amount: expectedAmount,
      verifierCode: slipVerifier ?? "SLIPOK",
      httpStatus: 200,
      rawRequest: { mode: "mock" },
      rawResponse: { mode: "mock" },
    }
  } else if (slipVerifier === "SLIPOK") {
    outcome = await _verifyWithSlipOk(fullConfig.slipok, resolvedInput, expectedAmount)
  } else if (slipVerifier === "SLIP2GO") {
    outcome = await _verifyWithSlip2Go(fullConfig.slip2go, resolvedInput, expectedAmount)
  } else {
    throw new AppError(
      "NO_VERIFIER",
      "No slip verifier configured for this payment. Set slipVerifier in BillerProfile.config.",
      500,
    )
  }

  // ── Record provider attempt ───────────────────────────────────────────────
  const verifierCode = outcome.verifierCode as string
  await prisma.providerAttempt.create({
    data: {
      paymentIntentId: payment.id,
      billerProfileId: payment.billerProfile.id,
      type: "VERIFY_SLIP",
      status: outcome.success ? "SUCCEEDED" : "FAILED",
      requestId: `req_${nanoid(20)}`,
      providerCode: (verifierCode === "NONE" ? "INTERNAL" : verifierCode) as any,
      providerEndpoint: "verify-slip",
      httpMethod: "POST",
      httpStatusCode: outcome.httpStatus,
      requestBody: outcome.rawRequest as never,
      responseBody: outcome.rawResponse as never,
      errorCode: outcome.success ? null : String(outcome.code),
      errorMessage: outcome.success ? null : outcome.message,
      sentAt: new Date(),
      completedAt: new Date(),
      providerTxnId: outcome.success ? outcome.transRef : null,
    },
  })

  // ── Apply outcome ─────────────────────────────────────────────────────────
  if (outcome.success) {
    await applyPaymentTransition({
      paymentIntentId: payment.id,
      toStatus: "SUCCEEDED",
      eventType: "SLIP_VERIFIED",
      summary: `Slip verified via ${outcome.verifierCode}`,
      patch: {
        providerTransactionId: outcome.transRef,
        succeededAt: new Date(),
      },
      payload: {
        transRef: outcome.transRef,
        senderName: outcome.senderName,
        receiverName: outcome.receiverName,
        amount: outcome.amount,
        verifier: outcome.verifierCode,
      },
    })

    await enqueueWebhookForPayment(payment.id, "PAYMENT_SUCCEEDED")

    return {
      publicId,
      status: "SUCCEEDED",
      transRef: outcome.transRef,
      senderName: outcome.senderName ?? null,
      receiverName: outcome.receiverName ?? null,
      verifiedAmount: outcome.amount,
    }
  } else {
    if (!outcome.retryable) {
      await applyPaymentTransition({
        paymentIntentId: payment.id,
        toStatus: "FAILED",
        eventType: "SLIP_REJECTED",
        summary: outcome.message,
        patch: {
          failureReason: outcome.message,
          lastErrorCode: String(outcome.code),
          lastErrorMessage: outcome.message,
          failedAt: new Date(),
        },
        payload: { verifierCode: outcome.code, message: outcome.message },
      })
      await enqueueWebhookForPayment(payment.id, "PAYMENT_FAILED")
    } else {
      // Retryable (bank delay): go back to AWAITING_CUSTOMER
      await applyPaymentTransition({
        paymentIntentId: payment.id,
        toStatus: "AWAITING_CUSTOMER",
        eventType: "SLIP_REJECTED",
        summary: outcome.message,
        allowedFrom: ["PROCESSING"],
        payload: { verifierCode: outcome.code, message: outcome.message, retryable: true },
      })
    }

    throw new AppError(
      outcome.retryable ? "SLIP_BANK_DELAY" : "SLIP_REJECTED",
      outcome.message,
      outcome.retryable ? 503 : 422,
      { verifierCode: outcome.code, retryable: outcome.retryable },
    )
  }
}

// ─── SlipOK ───────────────────────────────────────────────────────────────────

async function _verifyWithSlipOk(
  config: SlipOkConfig,
  input: Exclude<SubmitSlipInput, { method: "url" }>,
  expectedAmount: number,
): Promise<VerifyOutcome> {
  const result = input.method === "qr"
    ? await slipokVerifyQr(config, { qrData: input.qrData, amount: expectedAmount, log: true })
    : await slipokVerifyFile(config, { imageData: input.imageData, mimeType: input.mimeType, amount: expectedAmount, log: true })

  const { response, httpStatus, rawRequest, rawResponse } = result

  if (response.success) {
    const d = response.data as any
    return {
      success: true,
      transRef: d.transRef,
      senderName: d.sender?.name,
      receiverName: d.receiver?.name,
      amount: d.amount,
      verifierCode: "SLIPOK",
      httpStatus, rawRequest, rawResponse,
    }
  }

  const code = response.code as number
  const codeMap: Record<number, { msg: string; retry: boolean }> = {
    1010: { msg: "Bank processing delay — please try again shortly", retry: true },
    1012: { msg: "Duplicate slip — this slip has already been used", retry: false },
    1013: { msg: "Amount mismatch — slip amount does not match payment amount", retry: false },
    1014: { msg: "Wrong receiver — slip receiver does not match this payment", retry: false },
  }

  const mapped = codeMap[code]
  return {
    success: false,
    code,
    message: mapped?.msg ?? response.message,
    retryable: mapped?.retry ?? false,
    verifierCode: "SLIPOK",
    httpStatus, rawRequest, rawResponse,
  }
}

// ─── Slip2Go ──────────────────────────────────────────────────────────────────

async function _verifyWithSlip2Go(
  config: Slip2GoConfig,
  input: Exclude<SubmitSlipInput, { method: "url" }>,
  expectedAmount: number,
): Promise<VerifyOutcome> {
  const condition: Slip2GoCheckCondition = {
    checkDuplicate: true,
    checkAmount: { type: "eq", amount: expectedAmount },
  }

  if (config.receiverAccountNumber || config.receiverAccountNameTH || config.receiverAccountNameEN) {
    condition.checkReceiver = [{
      ...(config.receiverAccountNumber ? { accountNumber: config.receiverAccountNumber } : {}),
      ...(config.receiverAccountNameTH ? { accountNameTH: config.receiverAccountNameTH } : {}),
      ...(config.receiverAccountNameEN ? { accountNameEN: config.receiverAccountNameEN } : {}),
    }]
  }

  const result = input.method === "qr"
    ? await verifySlip2GoByQr(config, { qrCode: input.qrData, condition })
    : await verifySlip2GoByFile(config, { imageData: input.imageData, mimeType: input.mimeType, condition })

  const { response, httpStatus, rawRequest, rawResponse } = result

  if (response.code === "200000" && response.data) {
    const d = response.data as Slip2GoData
    return {
      success: true,
      transRef: d.transRef,
      senderName: d.sender?.account?.name,
      receiverName: d.receiver?.account?.name,
      amount: d.amount,
      verifierCode: "SLIP2GO",
      httpStatus, rawRequest, rawResponse,
    }
  }

  const codeMap: Record<string, { msg: string; retry: boolean }> = {
    "503001": { msg: "Bank service unavailable — please try again shortly", retry: true },
    "409001": { msg: "Duplicate slip — this slip has already been used", retry: false },
    "422001": { msg: "Condition not met — amount or receiver does not match", retry: false },
    "404001": { msg: "Slip not found or could not be verified", retry: false },
    "400001": { msg: "Invalid slip or QR code", retry: false },
  }

  const mapped = codeMap[response.code]
  return {
    success: false,
    code: response.code,
    message: mapped?.msg ?? response.message,
    retryable: mapped?.retry ?? false,
    verifierCode: "SLIP2GO",
    httpStatus, rawRequest, rawResponse,
  }
}
