// server/api/admin/tenants/index.post.ts
import { z } from "zod"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"

const schema = z.object({
  code: z.string().min(2).max(32).regex(/^[a-z0-9_-]+$/, "code must be lowercase alphanumeric"),
  name: z.string().min(1).max(100),
})

export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event))
  if (!body.success) {
    throw new AppError("VALIDATION_ERROR", body.error.errors[0]?.message ?? "Invalid input", 400)
  }

  const existing = await prisma.tenant.findUnique({ where: { code: body.data.code } })
  if (existing) throw new AppError("DUPLICATE_CODE", "Tenant code already exists", 409)

  const tenant = await prisma.tenant.create({
    data: { code: body.data.code, name: body.data.name },
  })

  return { id: tenant.id, code: tenant.code, name: tenant.name, status: tenant.status, createdAt: tenant.createdAt }
})
