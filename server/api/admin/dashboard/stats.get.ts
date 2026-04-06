// server/api/admin/dashboard/stats.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalPayments,
    payments24h,
    succeededToday,
    failedToday,
    totalRevenue,
    pendingCallbacks,
    deadWebhooks,
    activeMerchants,
    activeApiKeys,
  ] = await Promise.all([
    prisma.paymentIntent.count(),
    prisma.paymentIntent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "SUCCEEDED", succeededAt: { gte: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "FAILED", failedAt: { gte: since24h } } }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCEEDED" },
    }),
    prisma.providerCallback.count({ where: { processStatus: { in: ["RECEIVED", "QUEUED"] } } }),
    prisma.webhookDelivery.count({ where: { status: "DEAD" } }),
    prisma.merchantAccount.count({ where: { status: "ACTIVE" } }),
    prisma.apiKey.count({ where: { status: "ACTIVE" } }),
  ])

  // Revenue chart — last 7 days per day
  const revenueRows = await prisma.paymentIntent.groupBy({
    by: ["succeededAt"],
    _sum: { amount: true },
    _count: true,
    where: { status: "SUCCEEDED", succeededAt: { gte: since7d } },
  })

  // Bucket by day
  const dayMap: Record<string, { revenue: number; count: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dayMap[key] = { revenue: 0, count: 0 }
  }
  for (const row of revenueRows) {
    if (!row.succeededAt) continue
    const key = row.succeededAt.toISOString().slice(0, 10)
    if (dayMap[key]) {
      dayMap[key].revenue += Number(row._sum.amount ?? 0)
      dayMap[key].count += row._count
    }
  }
  const revenueChart = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }))

  // Status distribution today
  const statusRows = await prisma.paymentIntent.groupBy({
    by: ["status"],
    _count: true,
    where: { createdAt: { gte: since24h } },
  })

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      totalPayments,
      payments24h,
      succeededToday,
      failedToday,
      successRate24h: payments24h > 0 ? Math.round((succeededToday / payments24h) * 100) : 0,
      totalRevenueTHB: Number(totalRevenue._sum.amount ?? 0),
      pendingCallbacks,
      deadWebhooks,
      activeMerchants,
      activeApiKeys,
    },
    revenueChart,
    statusDistribution: statusRows.map((r) => ({ status: r.status, count: r._count })),
  }
})
