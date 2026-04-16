import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true, code: true, name: true, status: true, defaultCurrency: true, createdAt: true,
      _count: {
        select: {
          merchants: true,
          apiKeys: true,
          tenantUsers: true,
          billerProfiles: true,
          paymentRoutes: true,
          paymentIntents: true,
        },
      },
    },
  })
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })
  return tenant
})
