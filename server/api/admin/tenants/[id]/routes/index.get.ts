import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const items = await prisma.paymentRoute.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    include: {
      billerProfile: { select: { id: true, code: true, displayName: true } },
    },
  })
  return { items }
})
