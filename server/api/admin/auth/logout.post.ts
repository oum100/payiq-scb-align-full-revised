// server/api/admin/auth/logout.post.ts
import { revokeAdminSession } from "~~/server/services/admin/adminAuth"

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "payiq_admin_session")

  if (sessionToken) {
    await revokeAdminSession(sessionToken).catch(() => {})
  }

  deleteCookie(event, "payiq_admin_session", { path: "/" })
  return { ok: true }
})
