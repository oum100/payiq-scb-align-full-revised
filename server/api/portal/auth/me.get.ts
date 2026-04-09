// server/api/portal/auth/me.get.ts
import { resolvePortalSession } from "~~/server/services/portal/portalAuth"

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "payiq_portal_session")
  if (!sessionToken) throw createError({ statusCode: 401, message: "Not authenticated" })

  const user = await resolvePortalSession(sessionToken)
  if (!user) throw createError({ statusCode: 401, message: "Session expired" })

  return { user }
})
