import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const merchantAccountId = getRouterParam(event, 'merchantId')!
  const body = await readBody(event)
  const { paymentMethodType, paymentRouteId, priority } = body

  if (!paymentMethodType || !paymentRouteId) {
    throw createError({ statusCode: 400, message: 'paymentMethodType and paymentRouteId are required' })
  }

  // Validate route belongs to tenantId
  const route = await prisma.paymentRoute.findFirst({
    where: { id: paymentRouteId, tenantId },
  })
  if (!route) {
    throw createError({ statusCode: 404, message: 'Payment route not found or does not belong to this tenant' })
  }

  // Validate merchant belongs to tenant
  const merchant = await prisma.merchantAccount.findFirst({
    where: { id: merchantAccountId, tenantId },
  })
  if (!merchant) {
    throw createError({ statusCode: 404, message: 'Merchant not found' })
  }

  const assignment = await prisma.merchantRouteAssignment.upsert({
    where: {
      merchantAccountId_paymentMethodType: {
        merchantAccountId,
        paymentMethodType,
      },
    },
    update: {
      paymentRouteId,
      priority: priority !== undefined ? Number(priority) : 100,
    },
    create: {
      tenantId,
      merchantAccountId,
      paymentMethodType,
      paymentRouteId,
      priority: priority !== undefined ? Number(priority) : 100,
    },
    include: {
      paymentRoute: {
        include: { billerProfile: { select: { id: true, code: true, displayName: true, config: true } } }
      }
    },
  })

  return assignment
})
