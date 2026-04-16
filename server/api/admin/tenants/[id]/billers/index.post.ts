import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { code, displayName, environment, billerId, merchantIdAtProvider, priority, config } = body

  if (!code || !displayName || !environment) {
    throw createError({ statusCode: 400, message: 'code, displayName, environment are required' })
  }

  const biller = await prisma.billerProfile.create({
    data: {
      tenantId,
      code: code.toLowerCase().trim(),
      displayName: displayName.trim(),
      environment,
      billerId: billerId || null,
      merchantIdAtProvider: merchantIdAtProvider || null,
      priority: priority ? Number(priority) : 100,
      status: 'ACTIVE',
      config: config ?? undefined,
    },
  })
  return biller
})
