import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const items = await prisma.apiKey.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      status: true,
      scopes: true,
      environment: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      merchantAccount: { select: { code: true, name: true } },
    },
  })

  return { items }
})
