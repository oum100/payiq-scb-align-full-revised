import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const merchantId = getRouterParam(event, 'merchantId')!

  const merchant = await prisma.merchantAccount.findFirst({ where: { id: merchantId, tenantId } })
  if (!merchant) throw createError({ statusCode: 404, message: 'Merchant not found' })

  await prisma.merchantAccount.delete({ where: { id: merchantId } })
  return { ok: true }
})
