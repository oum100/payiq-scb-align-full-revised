// server/api/admin/payments/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page     = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
  const status   = typeof q.status === "string" && q.status ? q.status : undefined
  const search   = typeof q.search === "string" && q.search ? q.search.trim() : undefined
  const from     = typeof q.from === "string" && q.from ? new Date(q.from) : undefined
  const to       = typeof q.to === "string" && q.to ? new Date(q.to) : undefined

  const where: any = {}
  if (status) where.status = status
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) }
  if (search) {
    where.OR = [
      { publicId: { contains: search, mode: "insensitive" } },
      { merchantOrderId: { contains: search, mode: "insensitive" } },
      { merchantReference: { contains: search, mode: "insensitive" } },
      { providerTransactionId: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ]
  }

  const [total, items] = await Promise.all([
    prisma.paymentIntent.count({ where }),
    prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        publicId: true,
        status: true,
        amount: true,
        currency: true,
        providerCode: true,
        merchantOrderId: true,
        merchantReference: true,
        customerEmail: true,
        providerTransactionId: true,
        createdAt: true,
        succeededAt: true,
        failedAt: true,
        environment: true,
        merchantAccount: { select: { code: true, name: true } },
      },
    }),
  ])

  return {
    items: items.map((p) => ({ ...p, amount: p.amount.toString() })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
})
