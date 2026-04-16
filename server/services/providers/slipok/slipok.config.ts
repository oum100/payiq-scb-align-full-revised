import type { ProviderBillerProfile } from "../base/PaymentProvider"

export type SlipOkConfig = {
  apiKey: string
  apiBaseUrl: string
  timeoutMs: number
  branchCode?: string | null
}

export function getSlipOkConfig(billerProfile: ProviderBillerProfile): SlipOkConfig {
  const creds = billerProfile.credentialsEncrypted as Record<string, unknown> | null | undefined
  const config = billerProfile.config as Record<string, unknown> | null | undefined

  // Resolve API key: credentials take precedence, fallback to env var
  const apiKey =
    (creds?.slipokApiKey as string | undefined) ??
    (creds?.apiKey as string | undefined) ??
    process.env.SLIPOK_API_KEY ??
    ""

  const apiBaseUrl =
    (config?.apiBaseUrl as string | undefined) ??
    process.env.SLIPOK_API_BASE_URL ??
    "https://api.slipok.com/api/line/apikey"

  const timeoutMs = Number(
    (config?.timeoutMs as number | undefined) ??
    process.env.SLIPOK_TIMEOUT_MS ??
    15000,
  )

  const branchCode = (config?.branchCode as string | undefined) ?? null

  return { apiKey, apiBaseUrl, timeoutMs, branchCode }
}

export function isSlipOkMockMode(billerProfile: ProviderBillerProfile): boolean {
  const config = billerProfile.config as Record<string, unknown> | null | undefined
  if (config?.mock === true) return true
  if (billerProfile.environment === "TEST") return true
  const resolved = getSlipOkConfig(billerProfile)
  if (!resolved.apiKey || resolved.apiKey.startsWith("mock")) return true
  return false
}
