import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const merchantId = getRouterParam(event, 'merchantId')!

  const merchant = await prisma.merchantAccount.findFirst({
    where: { id: merchantId, tenantId },
    include: {
      _count: {
        select: {
          paymentIntents: true,
          apiKeys: true,
          webhookEndpoints: true,
        },
      },
      apiKeys: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, keyPrefix: true, name: true, status: true, environment: true, lastUsedAt: true, createdAt: true },
      },
      paymentIntents: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, publicId: true, status: true, amount: true, currency: true,
          paymentMethodType: true, providerCode: true, merchantOrderId: true,
          createdAt: true, succeededAt: true,
        },
      },
      merchantRouteAssignments: {
        include: {
          paymentRoute: {
            include: { billerProfile: { select: { id: true, code: true, displayName: true, config: true } } }
          }
        },
        orderBy: { paymentMethodType: 'asc' },
      },
    },
  })

  if (!merchant) throw createError({ statusCode: 404, message: 'Merchant not found' })

  return merchant
})
