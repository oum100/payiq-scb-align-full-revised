import type { PaymentProvider } from "../base/PaymentProvider"

/**
 * SlipOK is a slip-verification service, NOT a payment provider.
 *
 * It does NOT generate QR codes or process payments directly.
 * SlipOK is used as a verifier configured inside a THAI_QR BillerProfile:
 *
 *   BillerProfile.config.slipVerifier = "SLIPOK"
 *   BillerProfile.credentialsEncrypted.slipokApiKey = "<tenant's SlipOK API key>"
 *
 * The actual verification call happens in submitSlip.ts via slipok.client.ts.
 *
 * This adapter stub exists only so `registry.ts` does not throw if
 * SLIPOK appears as a providerCode anywhere in the system.
 */
export const slipokProvider: PaymentProvider = {
  async createPayment() {
    throw new Error("SLIPOK is a slip verifier, not a payment provider. Use THAI_QR as the route provider.")
  },
  async inquirePayment() {
    throw new Error("SLIPOK is a slip verifier, not a payment provider. Use THAI_QR as the route provider.")
  },
}
