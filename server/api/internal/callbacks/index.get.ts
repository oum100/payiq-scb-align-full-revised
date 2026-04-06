// server/api/internal/callbacks/index.get.ts
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page       = Math.max(1, Number(q.page) || 1)
  const pageSize   = Math.min(100, Math.max(1, Number(q.pageSize) || 30))
  const status     = typeof q.status === "string" && q.status ? q.status : undefined
  const providerCode = typeof q.providerCode === "string" && q.providerCode ? q.providerCode : undefined

  const where: any = {}
  if (status) where.processStatus = status
  if (providerCode) where.providerCode = providerCode

  const [total, items] = await Promise.all([
    prisma.providerCallback.count({ where }),
    prisma.providerCallback.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, providerCode: true, processStatus: true,
        signatureValid: true, providerReference: true, providerTxnId: true,
        errorMessage: true, receivedAt: true, processedAt: true, failedAt: true,
        paymentIntentId: true,
      },
    }),
  ])

  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
})
