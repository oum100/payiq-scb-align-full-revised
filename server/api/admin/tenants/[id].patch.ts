// server/api/admin/tenants/[id].patch.ts
import { z } from "zod"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")
  if (!id) throw new AppError("NOT_FOUND", "Tenant not found", 404)

  const body = schema.safeParse(await readBody(event))
  if (!body.success) {
    throw new AppError("VALIDATION_ERROR", body.error.errors[0]?.message ?? "Invalid input", 400)
  }

  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant) throw new AppError("NOT_FOUND", "Tenant not found", 404)

  const updated = await prisma.tenant.update({
    where: { id },
    data: body.data,
  })

  return { id: updated.id, code: updated.code, name: updated.name, status: updated.status }
})
