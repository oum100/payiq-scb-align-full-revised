import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const items = await prisma.merchantAccount.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { paymentIntents: true, apiKeys: true } },
    },
  })
  return { items }
})
