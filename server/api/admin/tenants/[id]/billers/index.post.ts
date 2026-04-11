import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { code, displayName, providerCode, environment, billerId, merchantIdAtProvider, priority } = body

  if (!code || !displayName || !providerCode || !environment) {
    throw createError({ statusCode: 400, message: 'code, displayName, providerCode, environment are required' })
  }

  const biller = await prisma.billerProfile.create({
    data: {
      tenantId,
      code: code.toLowerCase().trim(),
      displayName: displayName.trim(),
      providerCode,
      environment,
      billerId: billerId || null,
      merchantIdAtProvider: merchantIdAtProvider || null,
      priority: priority ? Number(priority) : 100,
      status: 'ACTIVE',
    },
  })
  return biller
})
