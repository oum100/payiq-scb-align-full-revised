import type { ProviderBillerProfile } from "../base/PaymentProvider"

export type Slip2GoConfig = {
  apiSecret: string
  apiBaseUrl: string
  timeoutMs: number
  // Optional receiver conditions to send in every verify request
  receiverAccountNumber?: string   // partial account number to match
  receiverAccountNameTH?: string
  receiverAccountNameEN?: string
}

export function getSlip2GoConfig(billerProfile: ProviderBillerProfile): Slip2GoConfig {
  const creds = billerProfile.credentialsEncrypted as Record<string, unknown> | null | undefined
  const config = billerProfile.config as Record<string, unknown> | null | undefined

  const apiSecret =
    (creds?.slip2goApiSecret as string | undefined) ??
    (creds?.apiSecret as string | undefined) ??
    process.env.SLIP2GO_API_SECRET ??
    ""

  const apiBaseUrl =
    (config?.apiBaseUrl as string | undefined) ??
    process.env.SLIP2GO_API_BASE_URL ??
    "https://connect.slip2go.com/api"

  const timeoutMs = Number(
    (config?.timeoutMs as number | undefined) ??
    process.env.SLIP2GO_TIMEOUT_MS ??
    15000,
  )

  return {
    apiSecret,
    apiBaseUrl,
    timeoutMs,
    receiverAccountNumber: (config?.receiverAccountNumber as string | undefined) ?? undefined,
    receiverAccountNameTH: (config?.receiverAccountNameTH as string | undefined) ?? undefined,
    receiverAccountNameEN: (config?.receiverAccountNameEN as string | undefined) ?? undefined,
  }
}

export function isSlip2GoMockMode(billerProfile: ProviderBillerProfile): boolean {
  const config = billerProfile.config as Record<string, unknown> | null | undefined
  if (config?.mock === true) return true
  if (billerProfile.environment === "TEST") return true
  const resolved = getSlip2GoConfig(billerProfile)
  if (!resolved.apiSecret || resolved.apiSecret.startsWith("mock")) return true
  return false
}
