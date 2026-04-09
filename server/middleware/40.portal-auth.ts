// server/middleware/40.portal-auth.ts
import { resolvePortalSession } from "~~/server/services/portal/portalAuth"

const PUBLIC_PATHS = [
  "/portal/login",
  "/portal/auth/callback",
  "/api/portal/auth/magic-link",
  "/api/portal/auth/verify",
  "/api/portal/auth/logout",
]

function isPortalPath(path: string) {
  return path.startsWith("/portal") || path.startsWith("/api/portal")
}
function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "?"))
}

export default defineEventHandler(async (event) => {
  const path = event.path
  if (!isPortalPath(path)) return
  if (isPublicPath(path)) return

  const sessionToken = getCookie(event, "payiq_portal_session")
  if (!sessionToken) return sendRedirect(event, "/portal/login")

  const user = await resolvePortalSession(sessionToken)
  if (!user) {
    deleteCookie(event, "payiq_portal_session", { path: "/" })
    return sendRedirect(event, "/portal/login?error=session_expired")
  }

  event.context.portalUser = user
})
