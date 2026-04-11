// POST /api/admin/tenants/:id/users
import { prisma } from "~~/server/lib/prisma"

export default defineEventHandler(async (event) => {
  const tenantId = getRouterParam(event, "id")!
  const body = await readBody(event)
  const { email, name, role = "VIEWER" } = body ?? {}

  if (!email) throw createError({ statusCode: 400, message: "email is required" })
  if (!["OWNER", "ADMIN", "VIEWER"].includes(role))
    throw createError({ statusCode: 400, message: "Invalid role" })

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw createError({ statusCode: 404, message: "Tenant not found" })

  try {
    const user = await prisma.tenantUser.create({
      data: { tenantId, email: email.trim().toLowerCase(), name: name?.trim() || null, role, isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })
    return user
  } catch (e: any) {
    if (e.code === "P2002") throw createError({ statusCode: 409, message: "Email already exists for this tenant" })
    throw e
  }
})
