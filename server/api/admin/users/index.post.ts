// server/api/admin/users/index.post.ts
import { z } from "zod"
import { prisma } from "~~/server/lib/prisma"
import { AppError } from "~~/server/lib/errors"

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
})

export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event))
  if (!body.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid input", 400)
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: body.data.email } })
  if (existing) throw new AppError("DUPLICATE_EMAIL", "Email already registered", 409)

  const user = await prisma.adminUser.create({
    data: { email: body.data.email, name: body.data.name ?? null, isActive: true },
  })

  return { id: user.id, email: user.email, name: user.name, isActive: user.isActive, createdAt: user.createdAt }
})
