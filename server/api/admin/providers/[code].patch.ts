import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')!
  const body = await readBody(event)
  const {
    healthMethod,
    pingUrl,
    pingTimeoutMs,
    pingExpectStatus,
    activitySource,
    activityWarnMinutes,
    activityStaleMinutes,
    displayName,
    isActive,
  } = body

  const updated = await prisma.provider.update({
    where: { code },
    data: {
      ...(displayName !== undefined && { displayName }),
      ...(isActive !== undefined && { isActive }),
      ...(healthMethod !== undefined && { healthMethod }),
      ...(pingUrl !== undefined && { pingUrl }),
      ...(pingTimeoutMs !== undefined && { pingTimeoutMs: Number(pingTimeoutMs) }),
      ...(pingExpectStatus !== undefined && { pingExpectStatus: Number(pingExpectStatus) }),
      ...(activitySource !== undefined && { activitySource }),
      ...(activityWarnMinutes !== undefined && { activityWarnMinutes: Number(activityWarnMinutes) }),
      ...(activityStaleMinutes !== undefined && { activityStaleMinutes: Number(activityStaleMinutes) }),
    },
  })
  return updated
})
