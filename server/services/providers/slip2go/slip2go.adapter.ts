import type { PaymentProvider } from "../base/PaymentProvider"

/**
 * Slip2Go is a slip-verification service, NOT a payment provider.
 *
 * It does NOT generate QR codes or process payments directly.
 * Slip2Go is used as a verifier configured inside a THAI_QR BillerProfile:
 *
 *   BillerProfile.config.slipVerifier = "SLIP2GO"
 *   BillerProfile.credentialsEncrypted.slip2goApiSecret = "<tenant's Slip2Go API secret>"
 *
 * The actual verification call happens in submitSlip.ts via slip2go.client.ts.
 *
 * This adapter stub exists only so `registry.ts` does not throw if
 * SLIP2GO appears as a providerCode anywhere in the system.
 */
export const slip2goProvider: PaymentProvider = {
  async createPayment() {
    throw new Error("SLIP2GO is a slip verifier, not a payment provider. Use THAI_QR as the route provider.")
  },
  async inquirePayment() {
    throw new Error("SLIP2GO is a slip verifier, not a payment provider. Use THAI_QR as the route provider.")
  },
}
