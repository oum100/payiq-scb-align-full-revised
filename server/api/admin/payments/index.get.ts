// server/api/admin/payments/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page        = Math.max(1, Number(q.page) || 1)
  const pageSize    = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
  const status      = typeof q.status === "string" && q.status ? q.status : undefined
  const search      = typeof q.search === "string" && q.search ? q.search.trim() : undefined
  const from        = typeof q.from === "string" && q.from ? new Date(q.from) : undefined
  const to          = typeof q.to === "string" && q.to ? new Date(q.to) : undefined
  const tenantId    = typeof q.tenantId === "string" && q.tenantId ? q.tenantId : undefined
  const merchantId  = typeof q.merchantId === "string" && q.merchantId ? q.merchantId : undefined
  const environment = typeof q.environment === "string" && q.environment ? q.environment : undefined

  const where: any = {}
  if (status)      where.status = status
  if (tenantId)    where.tenantId = tenantId
  if (merchantId)  where.merchantAccountId = merchantId
  if (environment) where.environment = environment
  if (from || to)  where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) }
  if (search) {
    where.OR = [
      { publicId:              { contains: search, mode: "insensitive" } },
      { merchantOrderId:       { contains: search, mode: "insensitive" } },
      { merchantReference:     { contains: search, mode: "insensitive" } },
      { providerTransactionId: { contains: search, mode: "insensitive" } },
      { customerEmail:         { contains: search, mode: "insensitive" } },
      { customerName:          { contains: search, mode: "insensitive" } },
      { description:           { contains: search, mode: "insensitive" } },
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
        environment: true,
        merchantOrderId: true,
        merchantReference: true,
        customerName: true,
        customerEmail: true,
        providerTransactionId: true,
        description: true,
        createdAt: true,
        succeededAt: true,
        failedAt: true,
        tenant: { select: { id: true, code: true, name: true } },
        merchantAccount: { select: { id: true, code: true, name: true } },
      },
    }),
  ])

  return {
    items: items.map((p) => ({
      id: p.id,
      publicId: p.publicId,
      status: p.status,
      amount: p.amount.toString(),
      currency: p.currency,
      providerCode: p.providerCode,
      environment: p.environment,
      merchantOrderId: p.merchantOrderId,
      merchantReference: p.merchantReference,
      customerName: p.customerName,
      customerEmail: p.customerEmail,
      providerTransactionId: p.providerTransactionId,
      description: p.description,
      createdAt: p.createdAt,
      succeededAt: p.succeededAt,
      failedAt: p.failedAt,
      tenant: p.tenant,
      merchantAccount: p.merchantAccount,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
})
