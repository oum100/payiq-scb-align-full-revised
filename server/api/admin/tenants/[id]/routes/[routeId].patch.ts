import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const routeId = getRouterParam(event, 'routeId')!
  const body = await readBody(event)
  const { billerProfileId, providerId, isDefault, priority, status } = body

  const existing = await prisma.paymentRoute.findFirst({ where: { id: routeId, tenantId } })
  if (!existing) throw createError({ statusCode: 404, message: 'Route not found' })

  if (billerProfileId) {
    const biller = await prisma.billerProfile.findFirst({ where: { id: billerProfileId, tenantId } })
    if (!biller) throw createError({ statusCode: 400, message: 'Biller not found for this tenant' })
  }

  if (providerId) {
    const provider = await prisma.provider.findFirst({ where: { id: providerId, isActive: true } })
    if (!provider) throw createError({ statusCode: 400, message: 'Provider not found or inactive' })
  }

  const updated = await prisma.paymentRoute.update({
    where: { id: routeId },
    data: {
      ...(billerProfileId !== undefined && { billerProfileId }),
      ...(providerId !== undefined && { providerId }),
      ...(isDefault !== undefined && { isDefault }),
      ...(priority !== undefined && { priority: Number(priority) }),
      ...(status !== undefined && { status }),
    },
    include: {
      billerProfile: { select: { id: true, code: true, displayName: true } },
      provider: { select: { id: true, code: true, displayName: true, type: true } },
    },
  })
  return updated
})
