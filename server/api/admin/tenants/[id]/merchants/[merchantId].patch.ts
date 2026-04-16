import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const merchantId = getRouterParam(event, 'merchantId')!
  const body = await readBody(event)

  const merchant = await prisma.merchantAccount.findFirst({ where: { id: merchantId, tenantId } })
  if (!merchant) throw createError({ statusCode: 404, message: 'Merchant not found' })

  const updated = await prisma.merchantAccount.update({
    where: { id: merchantId },
    data: {
      ...(body.name ? { name: body.name.trim() } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.callbackBaseUrl !== undefined ? { callbackBaseUrl: body.callbackBaseUrl || null } : {}),
    },
  })
  return updated
})
