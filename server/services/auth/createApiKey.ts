import { prisma } from "~/server/lib/prisma"
import { AppError } from "~/server/lib/errors"
import {
  buildFullApiKey,
  generateApiKeySecret,
  generateKeyPrefix,
  hashApiKeySecret,
} from "~/server/lib/apiKeyCrypto"

export type ApiKeyEnvironmentInput = "test" | "live" | "TEST" | "LIVE"

function toEnvironmentMode(environment?: ApiKeyEnvironmentInput): "TEST" | "LIVE" {
  return String(environment || "test").toUpperCase() === "LIVE" ? "LIVE" : "TEST"
}

export async function createApiKey(params: {
  tenantCode: string
  merchantCode?: string
  name: string
  scopes: string[]
  environment?: ApiKeyEnvironmentInput
  expiresAt?: Date | null
}) {
  const tenant = await prisma.tenant.findUnique({ where: { code: params.tenantCode } })
  if (!tenant) throw new AppError("TENANT_NOT_FOUND", "Tenant not found", 404)

  const merchant = params.merchantCode
    ? await prisma.merchantAccount.findFirst({ where: { tenantId: tenant.id, code: params.merchantCode } })
    : null

  if (params.merchantCode && !merchant) {
    throw new AppError("MERCHANT_NOT_FOUND", "Merchant not found", 404)
  }

  const environment = toEnvironmentMode(params.environment)
  const keyPrefix = generateKeyPrefix(environment === "LIVE" ? "live" : "test")
  const secret = generateApiKeySecret()
  const secretHash = hashApiKeySecret(secret)

  const created = await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      merchantAccountId: merchant?.id || null,
      keyPrefix,
      secretHash,
      name: params.name,
      status: "ACTIVE",
      scopes: params.scopes,
      environment,
      expiresAt: params.expiresAt || null,
    },
  })

  return {
    id: created.id,
    keyPrefix: created.keyPrefix,
    fullKey: buildFullApiKey(keyPrefix, secret),
    environment: created.environment,
    scopes: created.scopes,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  }
}
