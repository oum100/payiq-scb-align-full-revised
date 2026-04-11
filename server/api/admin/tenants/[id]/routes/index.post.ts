import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { code, paymentMethodType, providerCode, environment, billerProfileId, currency, isDefault, priority } = body

  if (!code || !paymentMethodType || !providerCode || !environment || !billerProfileId) {
    throw createError({ statusCode: 400, message: 'code, paymentMethodType, providerCode, environment, billerProfileId are required' })
  }

  // Verify biller belongs to tenant
  const biller = await prisma.billerProfile.findFirst({ where: { id: billerProfileId, tenantId } })
  if (!biller) throw createError({ statusCode: 400, message: 'Biller not found for this tenant' })

  const route = await prisma.paymentRoute.create({
    data: {
      tenantId,
      code: code.toLowerCase().trim(),
      paymentMethodType,
      providerCode,
      environment,
      billerProfileId,
      currency: currency || 'THB',
      isDefault: isDefault ?? false,
      priority: priority ? Number(priority) : 100,
      status: 'ACTIVE',
    },
    include: { billerProfile: { select: { id: true, code: true, displayName: true } } },
  })
  return route
})
