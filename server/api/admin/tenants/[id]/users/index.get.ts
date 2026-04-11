// GET /api/admin/tenants/:id/users
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, "id")!

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, code: true } })
  if (!tenant) throw createError({ statusCode: 404, message: "Tenant not found" })

  const users = await prisma.tenantUser.findMany({
    where: { tenantId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, lastLoginAt: true, createdAt: true,
    },
  })

  return { tenant, users }
})
