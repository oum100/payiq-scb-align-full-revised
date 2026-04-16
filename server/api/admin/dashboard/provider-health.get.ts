import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async () => {
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })
  const results = await Promise.all(providers.map(checkProvider))
  return { providers: results, generatedAt: new Date().toISOString() }
})

async function checkProvider(p: any) {
  // include raw config so UI can pre-fill edit modal
  const config = {
    pingUrl: p.pingUrl, pingTimeoutMs: p.pingTimeoutMs, pingExpectStatus: p.pingExpectStatus,
    activitySource: p.activitySource, activityWarnMinutes: p.activityWarnMinutes, activityStaleMinutes: p.activityStaleMinutes,
  }
  const base = { code: p.code, displayName: p.displayName, type: p.type, method: p.healthMethod, config }

  if (p.healthMethod === 'disabled') {
    return { ...base, status: 'DISABLED', detail: 'ไม่ได้ใช้งาน' }
  }

  if (p.healthMethod === 'ping') {
    const start = Date.now()
    try {
      const res = await $fetch.raw(p.pingUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(p.pingTimeoutMs ?? 5000),
        ignoreResponseError: true,
      })
      const latencyMs = Date.now() - start
      const ok = res.status === (p.pingExpectStatus ?? 200)
      return {
        ...base,
        status: ok ? 'UP' : 'WARN',
        latencyMs,
        httpStatus: res.status,
        detail: `HTTP ${res.status} · ${latencyMs}ms`,
        checkedAt: new Date().toISOString(),
      }
    } catch (e: any) {
      const latencyMs = Date.now() - start
      const isTimeout = e?.name === 'TimeoutError'
      return {
        ...base,
        status: 'DOWN',
        latencyMs,
        detail: isTimeout ? `Timeout (>${p.pingTimeoutMs ?? 5000}ms)` : (e?.message ?? 'Connection failed'),
        checkedAt: new Date().toISOString(),
      }
    }
  }

  if (p.healthMethod === 'activity') {
    const src    = p.activitySource ?? 'both'
    const warnMs  = (p.activityWarnMinutes  ?? 30) * 60000
    const staleMs = (p.activityStaleMinutes ?? 60) * 60000

    const [lastAttempt, lastCallback] = await Promise.all([
      src === 'callback' ? null : prisma.providerAttempt.findFirst({
        where: { providerCode: p.code },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, status: true, httpStatusCode: true, latencyMs: true },
      }),
      src === 'attempt' ? null : prisma.providerCallback.findFirst({
        where: { providerCode: p.code },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
    ])

    const timestamps: Date[] = []
    if (lastAttempt?.createdAt)   timestamps.push(lastAttempt.createdAt)
    if (lastCallback?.receivedAt) timestamps.push(lastCallback.receivedAt)

    if (!timestamps.length) return { ...base, status: 'UNKNOWN', detail: 'ไม่มีข้อมูล activity' }

    const latestAt = new Date(Math.max(...timestamps.map(t => t.getTime())))
    const msSince  = Date.now() - latestAt.getTime()
    const minSince = Math.round(msSince / 60000)
    const status   = msSince > staleMs ? 'STALE' : msSince > warnMs ? 'WARN' : 'UP'

    return {
      ...base,
      status,
      minutesSince: minSince,
      lastActivityAt: latestAt.toISOString(),
      latencyMs: lastAttempt?.latencyMs ?? null,
      detail: minSince < 1 ? 'Activity เมื่อกี้' : `Activity ล่าสุด ${minSince} นาทีที่แล้ว`,
    }
  }

  return { ...base, status: 'UNKNOWN', detail: 'Unknown method' }
}
