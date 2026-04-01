export type ProviderBillerProfile = {
  id: string
  providerCode: string
  environment?: "TEST" | "LIVE" | null
  billerId?: string | null
  merchantIdAtProvider?: string | null
  credentialsRef?: string | null
  credentialsEncrypted?: unknown | null
  config?: unknown
}

export type CreateProviderPaymentInput = {
  paymentIntentId: string
  publicId: string
  amount: string
  currency: string
  merchantOrderId?: string | null
  merchantReference?: string | null
  expiresAt?: string | null
  callbackUrl: string
  billerProfile: ProviderBillerProfile
}

export type CreateProviderPaymentResult = {
  providerReference?: string | null
  providerTransactionId?: string | null
  providerQrRef?: string | null
  qrPayload?: string | null
  deeplinkUrl?: string | null
  redirectUrl?: string | null
  rawRequest?: unknown
  rawResponse?: unknown
  providerMetadata?: Record<string, unknown> | null
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
}

export type ProviderInquiryResult = {
  providerReference?: string | null
  providerTransactionId?: string | null
  providerQrRef?: string | null
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED"
  rawResponse?: unknown
}

export interface PaymentProvider {
  createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<CreateProviderPaymentResult>

  inquirePayment(input: {
    providerReference?: string | null
    providerTransactionId?: string | null
    billerProfile: ProviderBillerProfile
  }): Promise<ProviderInquiryResult>
}
