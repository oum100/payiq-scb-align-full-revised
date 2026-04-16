import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { code, paymentMethodType, providerId, environment, billerProfileId, currency, isDefault, priority } = body

  if (!code || !paymentMethodType || !providerId || !environment || !billerProfileId) {
    throw createError({ statusCode: 400, message: 'code, paymentMethodType, providerId, environment, billerProfileId are required' })
  }

  // Verify biller belongs to tenant
  const biller = await prisma.billerProfile.findFirst({ where: { id: billerProfileId, tenantId } })
  if (!biller) throw createError({ statusCode: 400, message: 'Biller not found for this tenant' })

  // Verify provider exists and is active
  const provider = await prisma.provider.findFirst({ where: { id: providerId, isActive: true } })
  if (!provider) throw createError({ statusCode: 400, message: 'Provider not found or inactive' })

  const route = await prisma.paymentRoute.create({
    data: {
      tenantId,
      code: code.toLowerCase().trim(),
      paymentMethodType,
      providerId,
      environment,
      billerProfileId,
      currency: currency || 'THB',
      isDefault: isDefault ?? false,
      priority: priority ? Number(priority) : 100,
      status: 'ACTIVE',
    },
    include: {
      billerProfile: { select: { id: true, code: true, displayName: true } },
      provider: { select: { id: true, code: true, displayName: true, type: true } },
    },
  })
  return route
})
