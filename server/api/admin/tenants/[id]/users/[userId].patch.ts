// PATCH /api/admin/tenants/:id/users/:userId
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, "id")!
  const userId = getRouterParam(event, "userId")!
  const body = await readBody(event)
  const { name, role, isActive } = body ?? {}

  const user = await prisma.tenantUser.findFirst({ where: { id: userId, tenantId } })
  if (!user) throw createError({ statusCode: 404, message: "User not found" })

  if (role !== undefined && !["OWNER", "ADMIN", "VIEWER"].includes(role))
    throw createError({ statusCode: 400, message: "Invalid role" })

  const updated = await prisma.tenantUser.update({
    where: { id: userId },
    data: {
      ...(name !== undefined ? { name: name?.trim() || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  })
  return updated
})
