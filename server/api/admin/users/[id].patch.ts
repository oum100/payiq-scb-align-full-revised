// server/api/admin/users/[id].patch.ts
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!
  const body = await readBody(event)

  const user = await prisma.adminUser.findUnique({ where: { id } })
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404)

  // ป้องกันไม่ให้ deactivate ตัวเอง
  const me = event.context.admin as { id: string } | undefined
  if (me?.id === id && body.isActive === false) {
    throw new AppError("FORBIDDEN", "Cannot deactivate your own account", 403)
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      ...(typeof body.isActive === "boolean" && { isActive: body.isActive }),
      ...(typeof body.name === "string" && { name: body.name }),
    },
  })

  // Revoke all sessions if deactivated
  if (body.isActive === false) {
    await prisma.adminSession.deleteMany({ where: { adminId: id } })
  }

  return { id: updated.id, email: updated.email, name: updated.name, isActive: updated.isActive }
})
