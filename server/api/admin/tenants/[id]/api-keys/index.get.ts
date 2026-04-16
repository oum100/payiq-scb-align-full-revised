import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const items = await prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      merchantAccount: { select: { id: true, code: true, name: true } },
    },
  })
  return {
    items: items.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      name: k.name,
      status: k.status,
      environment: k.environment,
      scopes: k.scopes,
      merchant: k.merchantAccount,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  }
})
