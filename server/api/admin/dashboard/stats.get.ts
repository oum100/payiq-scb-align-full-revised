// server/api/admin/dashboard/stats.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async () => {
  const now      = new Date()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const stuck15m = new Date(Date.now() - 15 * 60 * 1000)

  const [
    totalPayments,
    payments24h,
    payments24hPrev,       // 24h–48h ago for delta
    succeededToday,
    succeededPrev,
    failedToday,
    revenue24h,
    revenuePrev,
    totalRevenue,
    pendingCallbacks,
    deadWebhooks,
    activeMerchants,
    activeApiKeys,
    activeTenants,
    stuckTransactions,
  ] = await Promise.all([
    prisma.paymentIntent.count(),
    prisma.paymentIntent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.paymentIntent.count({ where: { createdAt: { gte: since48h, lt: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "SUCCEEDED", succeededAt: { gte: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "SUCCEEDED", succeededAt: { gte: since48h, lt: since24h } } }),
    prisma.paymentIntent.count({ where: { status: "FAILED", failedAt: { gte: since24h } } }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCEEDED", succeededAt: { gte: since24h } },
    }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCEEDED", succeededAt: { gte: since48h, lt: since24h } },
    }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCEEDED" },
    }),
    prisma.providerCallback.count({ where: { processStatus: { in: ["RECEIVED", "QUEUED"] } } }),
    prisma.webhookDelivery.count({ where: { status: "DEAD" } }),
    prisma.merchantAccount.count({ where: { status: "ACTIVE" } }),
    prisma.apiKey.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    // Stuck = non-terminal status, created > 15 min ago
    prisma.paymentIntent.count({
      where: {
        status: { in: ["CREATED", "ROUTING", "PROCESSING", "PENDING_PROVIDER", "AWAITING_CUSTOMER"] },
        createdAt: { lt: stuck15m },
      },
    }),
  ])

  // ── Revenue chart — last 7 days ──────────────────────────────
  const revenueRows = await prisma.paymentIntent.groupBy({
    by: ["succeededAt"],
    _sum: { amount: true },
    _count: true,
    where: { status: "SUCCEEDED", succeededAt: { gte: since7d } },
  })
  const dayMap: Record<string, { revenue: number; count: number }> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    dayMap[d.toISOString().slice(0, 10)] = { revenue: 0, count: 0 }
  }
  for (const row of revenueRows) {
    if (!row.succeededAt) continue
    const key = row.succeededAt.toISOString().slice(0, 10)
    if (dayMap[key]) {
      dayMap[key].revenue += Number(row._sum.amount ?? 0)
      dayMap[key].count   += row._count
    }
  }
  const revenueChart = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }))

  // ── Status distribution (24h) ────────────────────────────────
  const statusRows = await prisma.paymentIntent.groupBy({
    by: ["status"],
    _count: true,
    where: { createdAt: { gte: since24h } },
  })

  // ── Method breakdown (24h) ───────────────────────────────────
  const methodRows = await prisma.paymentIntent.groupBy({
    by: ["paymentMethodType"],
    _count: true,
    _sum: { amount: true },
    where: { createdAt: { gte: since24h } },
    orderBy: { _count: { paymentMethodType: "desc" } },
  })

  // ── Top 5 Tenants by 24h volume ──────────────────────────────
  const topTenantRows = await prisma.paymentIntent.groupBy({
    by: ["tenantId"],
    _count: true,
    _sum: { amount: true },
    where: { createdAt: { gte: since24h } },
    orderBy: { _count: { tenantId: "desc" } },
    take: 5,
  })
  // Fetch tenant names
  const topTenantIds = topTenantRows.map((r) => r.tenantId)
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: topTenantIds } },
    select: { id: true, name: true, code: true },
  })
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]))

  // Succeeded per tenant (24h) for per-tenant success rate
  const tenantSucceeded = await prisma.paymentIntent.groupBy({
    by: ["tenantId"],
    _count: true,
    where: { tenantId: { in: topTenantIds }, status: "SUCCEEDED", createdAt: { gte: since24h } },
  })
  const tenantSucceededMap = Object.fromEntries(tenantSucceeded.map((r) => [r.tenantId, r._count]))

  const topTenants = topTenantRows.map((r) => {
    const t = tenantMap[r.tenantId]
    const succeeded = tenantSucceededMap[r.tenantId] ?? 0
    return {
      tenantId: r.tenantId,
      name: t?.name ?? r.tenantId,
      code: t?.code ?? "",
      count: r._count,
      amount: Number(r._sum.amount ?? 0),
      successRate: r._count > 0 ? Math.round((succeeded / r._count) * 100) : 0,
    }
  })

  // ── Deltas ───────────────────────────────────────────────────
  const rev24h     = Number(revenue24h._sum.amount ?? 0)
  const revPrev    = Number(revenuePrev._sum.amount ?? 0)
  const revDelta   = revPrev > 0 ? Math.round(((rev24h - revPrev) / revPrev) * 100) : null

  const countDelta = payments24hPrev > 0
    ? Math.round(((payments24h - payments24hPrev) / payments24hPrev) * 100)
    : null

  const ratePrev   = payments24hPrev > 0 ? Math.round((succeededPrev / payments24hPrev) * 100) : null
  const rateCurrent = payments24h > 0 ? Math.round((succeededToday / payments24h) * 100) : 0

  return {
    generatedAt: now.toISOString(),
    stats: {
      totalPayments,
      payments24h,
      succeededToday,
      failedToday,
      successRate24h: rateCurrent,
      successRatePrev: ratePrev,
      revenue24hTHB: rev24h,
      revenueDeltaPct: revDelta,
      countDeltaPct: countDelta,
      totalRevenueTHB: Number(totalRevenue._sum.amount ?? 0),
      pendingCallbacks,
      deadWebhooks,
      activeMerchants,
      activeApiKeys,
      activeTenants,
      stuckTransactions,
    },
    revenueChart,
    statusDistribution: statusRows.map((r) => ({ status: r.status, count: r._count })),
    methodBreakdown: methodRows.map((r) => ({
      method: r.paymentMethodType ?? "UNKNOWN",
      count: r._count,
      amount: Number(r._sum.amount ?? 0),
    })),
    topTenants,
  }
})
