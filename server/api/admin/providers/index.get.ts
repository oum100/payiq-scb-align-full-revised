import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async () => {
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      displayName: true,
      type: true,
      sortOrder: true,
      healthMethod: true,
      pingUrl: true,
      pingTimeoutMs: true,
      pingExpectStatus: true,
      activitySource: true,
      activityWarnMinutes: true,
      activityStaleMinutes: true,
    },
  })
  return { providers }
})
