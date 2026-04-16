import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const billerId = getRouterParam(event, 'billerId')!
  const body = await readBody(event)
  const { displayName, billerId: bId, merchantIdAtProvider, status, priority, config } = body

  const biller = await prisma.billerProfile.findFirst({ where: { id: billerId, tenantId } })
  if (!biller) throw createError({ statusCode: 404, message: 'Biller not found' })

  const updated = await prisma.billerProfile.update({
    where: { id: billerId },
    data: {
      ...(displayName !== undefined && { displayName: displayName.trim() }),
      ...(bId !== undefined && { billerId: bId || null }),
      ...(merchantIdAtProvider !== undefined && { merchantIdAtProvider: merchantIdAtProvider || null }),
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority: Number(priority) }),
      ...(config !== undefined && { config: config ?? null }),
    },
  })
  return updated
})
