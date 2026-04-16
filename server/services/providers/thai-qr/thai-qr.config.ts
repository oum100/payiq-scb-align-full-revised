import type { ProviderBillerProfile } from "../base/PaymentProvider"
import type { ThaiQrBillerConfig } from "./thai-qr.generator"

export type SlipVerifierType = "SLIPOK" | "SLIP2GO"

/**
 * Full resolved config for a THAI_QR biller profile.
 * Stored in BillerProfile:
 *   .config              → QR generation + verifier type + verifier options
 *   .credentialsEncrypted → verifier API key/secret (sensitive, per-tenant)
 */
export type ThaiQrFullConfig = {
  // ── Receiving account (used to generate QR) ─────────────────────────────
  qr: ThaiQrBillerConfig

  // ── Slip verifier ────────────────────────────────────────────────────────
  slipVerifier: SlipVerifierType | null

  // SlipOK options (when slipVerifier === "SLIPOK")
  slipok: {
    apiKey: string
    apiBaseUrl: string
    branchCode: string
    timeoutMs: number
  }

  // Slip2Go options (when slipVerifier === "SLIP2GO")
  slip2go: {
    apiSecret: string
    apiBaseUrl: string
    timeoutMs: number
    // Optional receiver conditions to verify against
    receiverAccountNumber?: string
    receiverAccountNameTH?: string
    receiverAccountNameEN?: string
  }

  mock: boolean
}

export function getThaiQrFullConfig(billerProfile: ProviderBillerProfile): ThaiQrFullConfig {
  const cfg = (billerProfile.config ?? {}) as Record<string, unknown>
  const creds = (billerProfile.credentialsEncrypted ?? {}) as Record<string, unknown>

  // maeMaNee type doesn't use promptpayId — it uses maeManeeBillerId instead
  const isMaeMaNee = cfg.promptpayIdType === "maeMaNee"
  const mock =
    cfg.mock === true ||
    (!isMaeMaNee && billerProfile.environment === "TEST" && !cfg.promptpayId)

  // ── QR generation config ─────────────────────────────────────────────────
  const qr: ThaiQrBillerConfig = {
    promptpayIdType: (cfg.promptpayIdType as ThaiQrBillerConfig["promptpayIdType"]) ?? "mobile",
    promptpayId: (cfg.promptpayId as string) ?? "",
    merchantName: (cfg.merchantName as string | undefined),
    merchantCity: (cfg.merchantCity as string | undefined),
    ref1Prefix: (cfg.ref1Prefix as string | undefined),
    // MaeMaNee / KShop fields
    maeManeeBillerId:   (cfg.maeManeeBillerId as string | undefined),
    maeManeeRef1:       (cfg.maeManeeRef1 as string | undefined),
    maeManeeTerminalId: (cfg.maeManeeTerminalId as string | undefined),
  }

  // ── Slip verifier ────────────────────────────────────────────────────────
  const slipVerifier = (cfg.slipVerifier as SlipVerifierType | undefined) ?? null

  const slipok = {
    apiKey:
      (creds.slipokApiKey as string | undefined) ??
      process.env.SLIPOK_API_KEY ?? "",
    apiBaseUrl:
      (cfg.slipokApiBaseUrl as string | undefined) ??
      process.env.SLIPOK_API_BASE_URL ??
      "https://api.slipok.com/api/line/apikey",
    branchCode: (cfg.slipokBranchCode as string | undefined) ?? "0",
    timeoutMs: Number(cfg.slipokTimeoutMs ?? process.env.SLIPOK_TIMEOUT_MS ?? 15000),
  }

  const slip2go = {
    apiSecret:
      (creds.slip2goApiSecret as string | undefined) ??
      process.env.SLIP2GO_API_SECRET ?? "",
    apiBaseUrl:
      (cfg.slip2goApiBaseUrl as string | undefined) ??
      process.env.SLIP2GO_API_BASE_URL ??
      "https://connect.slip2go.com/api",
    timeoutMs: Number(cfg.slip2goTimeoutMs ?? process.env.SLIP2GO_TIMEOUT_MS ?? 15000),
    receiverAccountNumber: cfg.slip2goReceiverAccountNumber as string | undefined,
    receiverAccountNameTH: cfg.slip2goReceiverAccountNameTH as string | undefined,
    receiverAccountNameEN: cfg.slip2goReceiverAccountNameEN as string | undefined,
  }

  return { qr, slipVerifier, slipok, slip2go, mock }
}

/**
 * Simpler helper used by the adapter (QR generation only).
 */
export { getThaiQrFullConfig as getThaiQrConfig }

export function isThaiQrMockMode(billerProfile: ProviderBillerProfile): boolean {
  const cfg = (billerProfile.config ?? {}) as Record<string, unknown>
  if (cfg.mock === true) return true
  // maeMaNee type doesn't use promptpayId — never auto-mock based on missing promptpayId
  if (cfg.promptpayIdType === "maeMaNee") return false
  if (!cfg.promptpayId && billerProfile.environment === "TEST") return true
  return false
}
