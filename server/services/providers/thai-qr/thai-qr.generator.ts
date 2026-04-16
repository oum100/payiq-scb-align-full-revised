import promptpay from "promptpay-js"

/**
 * PromptPay ID types supported by PayIQ Thai QR
 */
export type PromptPayIdType =
  | "mobile"      // phone number  e.g. "0812345678"
  | "nationalId"  // 13-digit citizen ID (same as taxId in Thai PromptPay — use this for both)
  | "eWalletId"   // 15-char e-wallet ID
  | "billerID"    // standard PromptPay Bill Payment (billerID + publicId as ref1 + merchantOrderId as ref2)
  | "maeMaNee"    // MaeMaNee / KShop bill payment — uses fixed billerID + ref1 (shop code) + ref2 (order) + terminalID

/**
 * Config stored in BillerProfile.config for THAI_QR provider
 */
export type ThaiQrBillerConfig = {
  promptpayIdType: PromptPayIdType
  promptpayId: string          // raw value — phone / nationalId / eWalletId / standard billerID

  merchantName?: string        // up to 25 chars, shown on banking app
  merchantCity?: string        // up to 15 chars

  // Standard bill payment (promptpayIdType === "billerID")
  ref1Prefix?: string          // optional prefix prepended to publicId for reference1

  // MaeMaNee / KShop bill payment (promptpayIdType === "maeMaNee")
  maeManeeBillerId?: string    // e.g. "010753600010286"  — from MaeMaNee merchant setup
  maeManeeRef1?: string        // e.g. "014000003906609"  — shop code, fixed per merchant
  maeManeeTerminalId?: string  // e.g. "0000000000591352" — terminal ID, fixed per merchant
}

/**
 * Normalise a Thai mobile number to international format required by promptpay-js.
 * "0812345678" → "0066812345678"
 * "66812345678" → "0066812345678"
 * Already "0066…" → unchanged
 */
function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0066")) return digits
  if (digits.startsWith("66")) return `00${digits}`
  if (digits.startsWith("0")) return `0066${digits.slice(1)}`
  return `0066${digits}`
}

/** Strip any character that is not A-Z, a-z, 0-9 */
function sanitizeRef(v: string): string {
  return v.replace(/[^A-Za-z0-9]/g, "")
}

/**
 * Generate a Thai PromptPay QR payload string.
 * Returns a QR_DYNAMIC payload (with embedded amount) ready to display.
 */
export function generateThaiQr(params: {
  billerConfig: ThaiQrBillerConfig
  amount: string
  publicId: string
  merchantOrderId?: string | null
}): string {
  const { billerConfig, amount, publicId, merchantOrderId } = params

  const baseConfig = {
    method: "QR_DYNAMIC" as const,
    currencyCode: "764",
    countryCode: "TH",
    amount,
    ...(billerConfig.merchantName ? { merchantName: billerConfig.merchantName.slice(0, 25) } : {}),
    ...(billerConfig.merchantCity ? { merchantCity: billerConfig.merchantCity.slice(0, 15) } : {}),
  }

  // ── MaeMaNee / KShop Bill Payment ────────────────────────────────────────
  if (billerConfig.promptpayIdType === "maeMaNee") {
    if (!billerConfig.maeManeeBillerId || !billerConfig.maeManeeRef1) {
      throw new Error("maeMaNee promptpayIdType requires maeManeeBillerId and maeManeeRef1 in BillerProfile.config")
    }

    const ref2 = merchantOrderId
      ? sanitizeRef(merchantOrderId).slice(0, 20)
      : sanitizeRef(publicId).slice(0, 20)

    return promptpay.generate({
      ...baseConfig,
      application: "PROMPTPAY_BILL_PAYMENT",
      billerID: billerConfig.maeManeeBillerId,
      reference1: billerConfig.maeManeeRef1,
      reference2: ref2,
      ...(billerConfig.maeManeeTerminalId
        ? { additional: { terminalID: billerConfig.maeManeeTerminalId } }
        : {}),
    })
  }

  // ── Standard Bill Payment ─────────────────────────────────────────────────
  if (billerConfig.promptpayIdType === "billerID") {
    const ref1 = billerConfig.ref1Prefix
      ? `${billerConfig.ref1Prefix}${publicId}`.slice(0, 20)
      : sanitizeRef(publicId).slice(0, 20)

    const ref2 = merchantOrderId
      ? sanitizeRef(merchantOrderId).slice(0, 20)
      : undefined

    return promptpay.generate({
      ...baseConfig,
      application: "PROMPTPAY_BILL_PAYMENT",
      billerID: billerConfig.promptpayId,
      reference1: ref1,
      ...(ref2 ? { reference2: ref2 } : {}),
    })
  }

  // ── Credit Transfer QR ────────────────────────────────────────────────────
  const idField: Record<string, string> = {}
  switch (billerConfig.promptpayIdType) {
    case "mobile":
      idField.mobileNumber = normalisePhone(billerConfig.promptpayId)
      break
    case "nationalId":
      idField.nationalID = billerConfig.promptpayId
      break
    case "eWalletId":
      idField.eWalletID = billerConfig.promptpayId
      break
  }

  return promptpay.generate({
    ...baseConfig,
    application: "PROMPTPAY_CREDIT_TRANSFER",
    ...idField,
  })
}

/**
 * Mock QR for TEST/sandbox mode (no real biller config needed).
 */
export function generateMockThaiQr(publicId: string, amount: string): string {
  const amountDigits = amount.replace(/[^\d.]/g, "")
  return promptpay.generate({
    method: "QR_DYNAMIC",
    application: "PROMPTPAY_CREDIT_TRANSFER",
    mobileNumber: "006600000000000",
    currencyCode: "764",
    countryCode: "TH",
    amount: amountDigits,
    merchantName: "PAYIQ TEST",
    additional: { referenceID: publicId.slice(0, 25) },
  })
}
