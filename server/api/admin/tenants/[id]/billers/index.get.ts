import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const items = await prisma.billerProfile.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, code: true, displayName: true,
      environment: true, billerId: true, merchantIdAtProvider: true,
      status: true, priority: true, createdAt: true, config: true,
      _count: { select: { paymentRoutes: true } },
    },
  })
  return { items }
})
