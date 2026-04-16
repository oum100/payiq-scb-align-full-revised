import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 2)

  const { count } = await prisma.apiKey.deleteMany({
    where: {
      tenantId,
      status: 'REVOKED',
      updatedAt: { lt: cutoff },
    },
  })

  return { ok: true, deleted: count }
})
