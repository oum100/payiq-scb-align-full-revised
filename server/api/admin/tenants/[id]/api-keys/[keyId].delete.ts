import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const keyId = getRouterParam(event, 'keyId')!

  const key = await prisma.apiKey.findFirst({ where: { id: keyId, tenantId } })
  if (!key) throw createError({ statusCode: 404, message: 'API key not found' })

  await prisma.apiKey.update({ where: { id: keyId }, data: { status: 'REVOKED' } })
  return { ok: true }
})
