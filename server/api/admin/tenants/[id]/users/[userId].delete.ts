// DELETE /api/admin/tenants/:id/users/:userId
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, "id")!
  const userId = getRouterParam(event, "userId")!

  const user = await prisma.tenantUser.findFirst({ where: { id: userId, tenantId } })
  if (!user) throw createError({ statusCode: 404, message: "User not found" })

  await prisma.tenantUser.delete({ where: { id: userId } })
  return { ok: true }
})
