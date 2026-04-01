import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  ProviderInquiryResult,
} from "../base/PaymentProvider"
import type {
  ScbCreateQrRequest,
  ScbCreateQrResponse,
  ScbInquiryItem,
  ScbInquiryRequest,
  ScbInquiryResponse,
} from "./scb.types"

function normalizeRef(value: string, maxLength = 20): string {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, maxLength).toUpperCase()
}

function formatExpiryDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined

  const yyyy = date.getUTCFullYear()
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const dd = `${date.getUTCDate()}`.padStart(2, "0")
  const hh = `${date.getUTCHours()}`.padStart(2, "0")
  const mi = `${date.getUTCMinutes()}`.padStart(2, "0")
  const ss = `${date.getUTCSeconds()}`.padStart(2, "0")

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

export function buildScbCreateQrRequest(args: {
  input: CreateProviderPaymentInput
  billerId: string
  callbackPrefix: string
}): ScbCreateQrRequest {
  const ref1 = normalizeRef(args.input.publicId)
  const ref2Source =
    args.input.merchantOrderId || args.input.merchantReference || undefined
  const ref2 = ref2Source ? normalizeRef(ref2Source) : undefined
  const ref3 = normalizeRef(`${args.callbackPrefix}${args.input.publicId}`, 20)
  const expiryDate = formatExpiryDate(args.input.expiresAt)

  return {
    qrType: "PP",
    amount: Number(args.input.amount),
    ppType: "BILLERID",
    ppId: args.billerId,
    ref1,
    ...(ref2 ? { ref2 } : {}),
    ref3,
    ...(expiryDate ? { expiryDate } : {}),
    numberOfTimes: 1,
  }
}

export function buildScbInquiryRequest(args: {
  billerId: string
  providerReference: string
  amount?: string | null
  transactionDate?: Date | null
  reference2?: string | null
}): ScbInquiryRequest {
  const date = args.transactionDate ?? new Date()
  const yyyy = date.getUTCFullYear()
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const dd = `${date.getUTCDate()}`.padStart(2, "0")

  return {
    eventCode: "00300100",
    transactionDate: `${yyyy}${mm}${dd}`,
    billerId: args.billerId,
    reference1: normalizeRef(args.providerReference),
    ...(args.reference2 ? { reference2: normalizeRef(args.reference2) } : {}),
    ...(args.amount ? { amount: args.amount } : {}),
  }
}

export function mapScbStatusToInternal(
  status?: string,
): "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" {
  const value = (status || "").trim().toUpperCase()

  if (
    [
      "SUCCESS",
      "SUCCEEDED",
      "PAID",
      "COMPLETED",
      "COMPLETE",
      "SETTLED",
      "AUTH",
      "AUTHORIZED",
    ].includes(value)
  ) {
    return "SUCCEEDED"
  }

  if (
    [
      "PENDING",
      "PROCESSING",
      "WAITING",
      "CREATED",
      "INITIATED",
      "INPROGRESS",
    ].includes(value)
  ) {
    return "PENDING"
  }

  if (["EXPIRED", "TIMEOUT"].includes(value)) {
    return "EXPIRED"
  }

  return "FAILED"
}

export function getScbResponseCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null

  const record = payload as Record<string, unknown>

  const nestedStatus = record.status
  if (nestedStatus && typeof nestedStatus === "object") {
    const code = (nestedStatus as Record<string, unknown>).code
    if (typeof code === "string" || typeof code === "number") {
      return String(code)
    }
  }

  const nestedData = record.data
  if (nestedData && typeof nestedData === "object") {
    const code = (nestedData as Record<string, unknown>).code
    if (typeof code === "string" || typeof code === "number") {
      return String(code)
    }
  }

  const topLevelCode = record.statusCode
  if (typeof topLevelCode === "string" || typeof topLevelCode === "number") {
    return String(topLevelCode)
  }

  return null
}

export function getScbResponseDescription(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null

  const record = payload as Record<string, unknown>

  const nestedStatus = record.status
  if (nestedStatus && typeof nestedStatus === "object") {
    const description = (nestedStatus as Record<string, unknown>).description
    if (typeof description === "string" && description.trim()) {
      return description.trim()
    }
  }

  const nestedData = record.data
  if (nestedData && typeof nestedData === "object") {
    const message = (nestedData as Record<string, unknown>).message
    if (typeof message === "string" && message.trim()) {
      return message.trim()
    }
  }

  const topLevelDesc = record.statusDesc
  if (typeof topLevelDesc === "string" && topLevelDesc.trim()) {
    return topLevelDesc.trim()
  }

  return null
}

export function mapScbCreateResponse(args: {
  request: ScbCreateQrRequest
  response: ScbCreateQrResponse | null
  ok: boolean
  rawRequest?: unknown
  rawResponse?: unknown
}): CreateProviderPaymentResult {
  const qrPayload =
    args.response?.data?.data?.qrRawData ||
    args.response?.qrRawData ||
    args.response?.qrCode ||
    null

  const redirectUrl =
    args.response?.data?.data?.url ||
    args.response?.redirectUrl ||
    null

  const providerTransactionId =
    args.response?.transactionId ||
    args.response?.data?.data?.transactionId ||
    args.response?.data?.transactionId ||
    null

  const providerReference =
    args.response?.data?.request?.ref1 ||
    args.request.ref1

  const providerQrRef =
    args.response?.data?.request?.ref3 ||
    args.request.ref3 ||
    null

  const success =
    args.ok &&
    Boolean(
      qrPayload ||
        redirectUrl ||
        args.response?.data?.success ||
        (args.response?.status?.code !== undefined &&
          String(args.response.status.code) === "1000"),
    )

  return {
    success,
    providerReference,
    providerTransactionId,
    providerQrRef,
    qrPayload,
    deeplinkUrl: null,
    redirectUrl,
    rawRequest: args.rawRequest,
    rawResponse: args.rawResponse,
    errorCode: success ? null : getScbResponseCode(args.response),
    errorMessage: success
      ? null
      : getScbResponseDescription(args.response) || "SCB create payment failed",
  }
}

function firstInquiryItem(response: ScbInquiryResponse | null): ScbInquiryItem | null {
  const data = response?.data
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }
  return data[0] || null
}

export function mapScbInquiryResponse(args: {
  request: ScbInquiryRequest
  response: ScbInquiryResponse | null
  rawResponse?: unknown
}): ProviderInquiryResult {
  const item = firstInquiryItem(args.response)

  const transactionId =
    item?.transactionId || null

  const providerReference =
    item?.billPaymentRef1 ||
    args.request.reference1 ||
    null

  const providerQrRef =
    item?.billPaymentRef3 || null

  const externalStatus =
    item?.status ||
    item?.paymentStatus ||
    item?.statusText ||
    undefined

  return {
    providerReference,
    providerTransactionId: transactionId,
    providerQrRef,
    status: mapScbStatusToInternal(externalStatus ?? (item ? "SUCCESS" : "FAILED")),
    rawResponse: args.rawResponse,
  }
}