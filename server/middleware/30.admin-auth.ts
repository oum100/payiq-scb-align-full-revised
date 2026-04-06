// server/middleware/30.admin-auth.ts
// ป้องกัน /admin/* ทุก route ยกเว้น login + verify

import { resolveAdminSession } from "~~/server/services/admin/adminAuth"

const PUBLIC_PATHS = [
  "/admin/login",
  "/admin/auth/callback",        // page ที่แสดง loading หลังคลิก magic link
  "/api/admin/auth/magic-link",
  "/api/admin/auth/verify",
  "/api/admin/auth/logout",
]

function isAdminPath(path: string) {
  return path.startsWith("/admin") || path.startsWith("/api/admin")
}

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "?"))
}

export default defineEventHandler(async (event) => {
  const path = event.path

  if (!isAdminPath(path)) return
  if (isPublicPath(path)) return

  const sessionToken = getCookie(event, "payiq_admin_session")
  if (!sessionToken) {
    return sendRedirect(event, "/admin/login")
  }

  const admin = await resolveAdminSession(sessionToken)
  if (!admin) {
    deleteCookie(event, "payiq_admin_session", { path: "/" })
    return sendRedirect(event, "/admin/login?error=session_expired")
  }

  // Inject admin context ให้ event handlers ใช้ได้
  event.context.admin = admin
})