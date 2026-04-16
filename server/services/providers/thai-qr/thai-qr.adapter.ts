import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProvider,
  ProviderBillerProfile,
  ProviderInquiryResult,
} from "../base/PaymentProvider"
import { getThaiQrConfig, isThaiQrMockMode } from "./thai-qr.config"
import { generateMockThaiQr, generateThaiQr } from "./thai-qr.generator"

/**
 * THAI_QR provider — generates PromptPay QR codes natively using promptpay-js.
 *
 * This provider does NOT call any external bank API.
 * - createPayment: generates a QR_DYNAMIC PromptPay payload locally
 * - inquirePayment: always PENDING — payment confirmation is driven by
 *   the customer submitting a transfer slip (POST /submit-slip)
 *
 * BillerProfile.config shape:
 * {
 *   "promptpayIdType": "mobile" | "nationalId" | "taxId" | "eWalletId" | "billerID",
 *   "promptpayId": "0812345678",
 *   "merchantName": "My Shop",         // optional, up to 25 chars
 *   "merchantCity": "Bangkok",         // optional, up to 15 chars
 *   "ref1Prefix": "ORD",               // optional, for billerID type only
 *   "mock": true                       // optional, force mock mode
 * }
 */
export const thaiQrProvider: PaymentProvider = {
  async createPayment(input: CreateProviderPaymentInput): Promise<CreateProviderPaymentResult> {
    const isMock = isThaiQrMockMode(input.billerProfile)

    let qrPayload: string
    let rawRequest: unknown

    if (isMock) {
      qrPayload = generateMockThaiQr(input.publicId, input.amount)
      rawRequest = { mode: "mock", publicId: input.publicId, amount: input.amount }
    } else {
      const fullConfig = getThaiQrConfig(input.billerProfile)

      qrPayload = generateThaiQr({
        billerConfig: fullConfig.qr,
        amount: input.amount,
        publicId: input.publicId,
        merchantOrderId: input.merchantOrderId,
      })

      const qrCfg = fullConfig.qr
      rawRequest = {
        mode: "thai_qr",
        promptpayIdType: qrCfg.promptpayIdType,
        promptpayId: qrCfg.promptpayId
          ? qrCfg.promptpayId.replace(/./g, (c, i) => i < qrCfg.promptpayId.length - 4 ? "x" : c)
          : "(maeMaNee)",
        amount: input.amount,
        publicId: input.publicId,
      }
    }

    return {
      success: true,
      providerReference: `THAIQR_${input.publicId}`,
      providerTransactionId: null,
      providerQrRef: null,
      qrPayload,
      deeplinkUrl: null,
      redirectUrl: null,
      rawRequest,
      rawResponse: { mode: isMock ? "mock" : "thai_qr", qrLength: qrPayload.length },
      errorCode: null,
      errorMessage: null,
    }
  },

  async inquirePayment(input: {
    providerReference?: string | null
    providerTransactionId?: string | null
    billerProfile: ProviderBillerProfile
  }): Promise<ProviderInquiryResult> {
    // THAI_QR has no server-side polling — payment is confirmed by slip submission only.
    return {
      providerReference: input.providerReference ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      providerQrRef: null,
      status: "PENDING",
      rawResponse: {
        note: "THAI_QR does not support status polling. Confirm via POST /submit-slip.",
      },
    }
  },
}
