import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { code, name, environment, callbackBaseUrl } = body

  if (!code || !name || !environment) {
    throw createError({ statusCode: 400, message: 'code, name, environment are required' })
  }

  const merchant = await prisma.merchantAccount.create({
    data: {
      tenantId,
      code: code.toLowerCase().trim(),
      name: name.trim(),
      environment,
      status: 'ACTIVE',
      callbackBaseUrl: callbackBaseUrl?.trim() || null,
    },
  })
  return merchant
})
