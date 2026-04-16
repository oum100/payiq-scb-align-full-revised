import type { PaymentProvider } from "./base/PaymentProvider"
import { scbProvider } from "./scb/scb.adapter"
import { slipokProvider } from "./slipok/slipok.adapter"
import { slip2goProvider } from "./slip2go/slip2go.adapter"
import { thaiQrProvider } from "./thai-qr/thai-qr.adapter"

export function getProviderAdapter(providerCode: string): PaymentProvider {
  switch (providerCode) {
    case "SCB":
      return scbProvider
    case "SLIPOK":
      return slipokProvider
    case "SLIP2GO":
      return slip2goProvider
    case "THAI_QR":
      return thaiQrProvider
    default:
      throw new Error(`Unsupported provider: ${providerCode}`)
  }
}

/**
 * Providers that use slip-based payment confirmation (no bank callback).
 * These support POST /submit-slip for verification.
 */
export const SLIP_BASED_PROVIDERS: string[] = ["SLIPOK", "SLIP2GO", "THAI_QR"]

export function isSlipBasedProvider(providerCode: string): boolean {
  return SLIP_BASED_PROVIDERS.includes(providerCode)
}
