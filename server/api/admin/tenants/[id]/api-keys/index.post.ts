import { prisma } from '~~/server/lib/prisma'
import { buildFullApiKey, generateApiKeySecret, generateKeyPrefix, hashApiKeySecret } from '~~/server/lib/apiKeyCrypto'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { merchantId, name, environment, scopes } = body

  if (!merchantId || !name || !environment) {
    throw createError({ statusCode: 400, message: 'merchantId, name, environment are required' })
  }

  const merchant = await prisma.merchantAccount.findFirst({ where: { id: merchantId, tenantId } })
  if (!merchant) throw createError({ statusCode: 404, message: 'Merchant not found' })

  const prefix = generateKeyPrefix(environment === 'LIVE' ? 'live' : 'test')
  const secret = generateApiKeySecret()
  const hash = hashApiKeySecret(secret)
  const fullKey = buildFullApiKey(prefix, secret)

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      merchantAccountId: merchantId,
      keyPrefix: prefix,
      secretHash: hash,
      name: name.trim(),
      environment: environment === 'LIVE' ? 'LIVE' : 'TEST',
      scopes: scopes ?? ['payments:create', 'payments:read'],
      status: 'ACTIVE',
    },
  })

  return {
    id: apiKey.id,
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    status: apiKey.status,
    environment: apiKey.environment,
    scopes: apiKey.scopes,
    fullKey, // shown once only
    createdAt: apiKey.createdAt.toISOString(),
  }
})
