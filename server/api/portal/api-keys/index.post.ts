import { z } from "zod"
import { prisma } from "~~/server/lib/prisma"
import { createApiKey } from "~~/server/services/auth/createApiKey"
import { AppError } from "~~/server/lib/errors"

const schema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  environment: z.enum(["test", "live"]).default("test"),
  expiresAt: z.string().datetime().optional(),
})

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  try {
    const body = schema.parse(await readBody(event))

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { code: true } })
    if (!tenant) throw new AppError("TENANT_NOT_FOUND", "Tenant not found", 404)

    return await createApiKey({
      tenantCode: tenant.code,
      name: body.name,
      scopes: body.scopes,
      environment: body.environment,
      ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
    })
  } catch (error: any) {
    if (error instanceof AppError) {
      setResponseStatus(event, error.statusCode)
      return { error: error.code, message: error.message }
    }
    setResponseStatus(event, 400)
    return { error: "BAD_REQUEST", message: error?.message || "Invalid request" }
  }
})
