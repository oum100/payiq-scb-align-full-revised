import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const q = getQuery(event)
  const page     = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
  const status   = typeof q.status === "string" && q.status ? q.status : undefined
  const search   = typeof q.search === "string" && q.search ? q.search.trim() : undefined

  const where: any = { tenantId: user.tenantId }
  if (status) where.status = status
  if (search) {
    where.OR = [
      { publicId:              { contains: search, mode: "insensitive" } },
      { merchantOrderId:       { contains: search, mode: "insensitive" } },
      { merchantReference:     { contains: search, mode: "insensitive" } },
      { providerTransactionId: { contains: search, mode: "insensitive" } },
      { customerEmail:         { contains: search, mode: "insensitive" } },
      { customerName:          { contains: search, mode: "insensitive" } },
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
        publicId: true,
        status: true,
        amount: true,
        currency: true,
        paymentMethodType: true,
        environment: true,
        merchantOrderId: true,
        merchantReference: true,
        customerName: true,
        customerEmail: true,
        createdAt: true,
        succeededAt: true,
        failedAt: true,
      },
    }),
  ])

  return {
    items: items.map((p) => ({
      ...p,
      amount: p.amount.toString(),
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
})
