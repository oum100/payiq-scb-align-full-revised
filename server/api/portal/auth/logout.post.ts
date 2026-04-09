// server/api/portal/auth/logout.post.ts
import { revokePortalSession } from "~~/server/services/portal/portalAuth"

export default defineEventHandler(async (event) => {
  const sessionToken = getCookie(event, "payiq_portal_session")
  if (sessionToken) await revokePortalSession(sessionToken)
  deleteCookie(event, "payiq_portal_session", { path: "/" })
  return { ok: true }
})
