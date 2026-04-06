// server/api/admin/auth/verify.get.ts
import { verifyMagicLink } from "~~/server/services/admin/adminAuth"
import { AppError } from "~~/server/lib/errors"

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)

  if (!token || typeof token !== "string") {
    return sendRedirect(event, "/admin/login?error=invalid_token")
  }

  try {
    const ua = getHeader(event, "user-agent") ?? undefined
    // X-Forwarded-For สำหรับ proxied environments
    const ip = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim()
      ?? getHeader(event, "x-real-ip")
      ?? undefined

    const { sessionToken, admin } = await verifyMagicLink(token, { ipAddress: ip, userAgent: ua })

    const SESSION_TTL_DAYS = 7

    // Set httpOnly session cookie
    setCookie(event, "payiq_admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    })

    console.log(`[Admin Auth] Login: ${admin.email}`)
    return sendRedirect(event, "/admin")
  } catch (err) {
    if (err instanceof AppError) {
      const errorMap: Record<string, string> = {
        INVALID_TOKEN: "invalid_token",
        TOKEN_USED: "token_used",
        TOKEN_EXPIRED: "token_expired",
        ADMIN_INACTIVE: "inactive",
      }
      const code = errorMap[err.code] ?? "error"
      return sendRedirect(event, `/admin/login?error=${code}`)
    }
    return sendRedirect(event, "/admin/login?error=error")
  }
})
