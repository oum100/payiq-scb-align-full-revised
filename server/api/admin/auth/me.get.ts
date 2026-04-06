// server/api/admin/auth/me.get.ts
import { resolveAdminSession } from "~~/server/services/admin/adminAuth"

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "payiq_admin_session")
  if (!sessionToken) {
    setResponseStatus(event, 401)
    return { error: "UNAUTHENTICATED" }
  }

  const admin = await resolveAdminSession(sessionToken)
  if (!admin) {
    setResponseStatus(event, 401)
    return { error: "UNAUTHENTICATED" }
  }

  return { admin }
})
