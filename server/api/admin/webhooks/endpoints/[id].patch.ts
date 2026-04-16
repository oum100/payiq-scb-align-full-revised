import { prisma } from "~~/server/lib/prisma"
import { z } from "zod"

const schema = z.object({
  maxAttempts: z.number().int().min(1).max(30).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!
  const body = schema.parse(await readBody(event))

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(body.maxAttempts !== undefined ? { maxAttempts: body.maxAttempts } : {}),
      ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: {
      tenant: { select: { id: true, code: true, name: true } },
      merchantAccount: { select: { id: true, code: true, name: true } },
    },
  })

  return {
    id: updated.id,
    code: updated.code,
    url: updated.url,
    status: updated.status,
    maxAttempts: updated.maxAttempts,
    timeoutMs: updated.timeoutMs,
    tenant: updated.tenant,
    merchant: updated.merchantAccount,
  }
})
