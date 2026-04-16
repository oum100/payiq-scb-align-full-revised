import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, 'id')!
  const query = getQuery(event)
  const period = (query.period as string) ?? 'day30' // 'hour24' | 'week' | 'day30' | 'month12'

  const now = new Date()

  let since: Date
  if (period === 'hour24') {
    since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  } else if (period === 'week') {
    // Go back to last Sunday
    const day = now.getDay() // 0=Sun
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
  } else if (period === 'month12') {
    since = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  } else {
    // day30
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
  }

  const payments = await prisma.paymentIntent.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: {
      createdAt: true,
      amount: true,
      status: true,
      paymentMethodType: true,
      merchantAccountId: true,
      merchantAccount: { select: { id: true, name: true } },
    },
  })

  // Build labels & keys
  const labels: string[] = []
  const labelKeys: string[] = []

  if (period === 'hour24') {
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 60 * 60 * 1000)
      const key = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}-${String(h.getHours()).padStart(2, '0')}`
      labelKeys.push(key)
      labels.push(`${String(h.getHours()).padStart(2, '0')}:00`)
    }
  } else if (period === 'week') {
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const startDay = now.getDay()
    for (let i = startDay; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      labelKeys.push(key)
      labels.push(DAY_NAMES[d.getDay()])
    }
  } else if (period === 'month12') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      labelKeys.push(key)
      labels.push(key)
    }
  } else {
    // day30
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      labelKeys.push(key)
      labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`)
    }
  }

  function getKey(createdAt: Date): string {
    const d = createdAt
    if (period === 'hour24') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}`
    } else if (period === 'month12') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    } else {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }

  // Collect merchants
  const merchantMap = new Map<string, string>()
  for (const p of payments) {
    if (p.merchantAccountId)
      merchantMap.set(p.merchantAccountId, p.merchantAccount?.name ?? p.merchantAccountId)
  }

  // merchant series
  const seriesMap = new Map<string, Map<string, number>>()
  for (const [mid] of merchantMap)
    seriesMap.set(mid, new Map(labelKeys.map(k => [k, 0])))

  // method series & totals
  const methodSeriesMap = new Map<string, Map<string, number>>()
  const methodTotalsMap = new Map<string, { count: number; amount: number }>()

  for (const p of payments) {
    const key = getKey(p.createdAt)

    if (p.merchantAccountId) {
      const ms = seriesMap.get(p.merchantAccountId)
      if (ms) ms.set(key, (ms.get(key) ?? 0) + 1)
    }

    const method = p.paymentMethodType ?? 'UNKNOWN'
    if (!methodSeriesMap.has(method))
      methodSeriesMap.set(method, new Map(labelKeys.map(k => [k, 0])))
    const ms = methodSeriesMap.get(method)!
    ms.set(key, (ms.get(key) ?? 0) + 1)

    const mt = methodTotalsMap.get(method) ?? { count: 0, amount: 0 }
    mt.count++
    mt.amount += Number(p.amount)
    methodTotalsMap.set(method, mt)
  }

  const merchants = [...merchantMap.entries()].map(([id, name]) => ({ id, name }))
  const byMerchant = merchants.map(m => ({
    merchantId: m.id,
    merchantName: m.name,
    data: labelKeys.map(k => seriesMap.get(m.id)?.get(k) ?? 0),
  }))
  const byMethod = [...methodTotalsMap.entries()]
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.count - a.count)
  const byMethodSeries = [...methodSeriesMap.entries()].map(([method, ms]) => ({
    method,
    data: labelKeys.map(k => ms.get(k) ?? 0),
  }))

  return { labels, merchants, byMerchant, byMethod, byMethodSeries, total: payments.length }
})
