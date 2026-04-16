import { requireApiKeyAuth } from "~~/server/lib/auth"

export default defineEventHandler(async (event) => {
  const auth = await requireApiKeyAuth(event)

  // Determine scope type
  const isMerchantScoped = auth.merchantAccountId !== null

  return {
    // Key identity
    keyPrefix: auth.apiKeyPrefix,
    scopes: auth.scopes,

    // Scope type — merchant-scoped หรือ tenant-scoped
    scopeType: isMerchantScoped ? "merchant" : "tenant",

    // Tenant info (always present)
    tenantId: auth.tenantId,
    tenantCode: auth.tenantCode,

    // Merchant info (present เฉพาะ merchant-scoped key)
    merchantAccountId: auth.merchantAccountId ?? undefined,
    merchantCode: auth.merchantCode ?? undefined,
  }
})
