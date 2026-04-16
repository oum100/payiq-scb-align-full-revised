import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!

  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })

  await prisma.tenant.delete({ where: { id } })
  return { ok: true }
})
