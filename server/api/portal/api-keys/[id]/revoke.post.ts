import { revokeApiKey } from "~~/server/services/auth/revokeApiKey"
import { AppError } from "~~/server/lib/errors"

export default defineEventHandler(async (event) => {
  const user = event.context.portalUser
  if (!user) throw createError({ statusCode: 401, message: "Unauthorized" })

  const id = getRouterParam(event, "id")
  if (!id) {
    setResponseStatus(event, 400)
    return { error: "BAD_REQUEST", message: "Missing API key id" }
  }

  try {
    const revoked = await revokeApiKey({ tenantId: user.tenantId, apiKeyId: id })
    return { id: revoked.id, keyPrefix: revoked.keyPrefix, revokedAt: revoked.revokedAt, status: revoked.status }
  } catch (error: any) {
    if (error instanceof AppError) {
      setResponseStatus(event, error.statusCode)
      return { error: error.code, message: error.message }
    }
    setResponseStatus(event, 400)
    return { error: "BAD_REQUEST", message: error?.message || "Invalid request" }
  }
})
