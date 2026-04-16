import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const merchantAccountId = getRouterParam(event, 'merchantId')!
  const assignments = await prisma.merchantRouteAssignment.findMany({
    where: { tenantId, merchantAccountId },
    include: {
      paymentRoute: {
        include: { billerProfile: { select: { id: true, code: true, displayName: true, config: true } } }
      }
    },
    orderBy: { paymentMethodType: 'asc' },
  })
  return { items: assignments }
})
