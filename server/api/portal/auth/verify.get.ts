// server/api/portal/auth/verify.get.ts
import { verifyPortalMagicLink } from "~~/server/services/portal/portalAuth"
import { AppError } from "~~/server/lib/errors"

const SESSION_TTL_DAYS = 7

export default defineEventHandler(async (event) => {
  const { token } = getQuery(event)
  if (!token || typeof token !== "string") {
    return sendRedirect(event, "/portal/login?error=invalid_token")
  }

  try {
    const ip = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim()
      ?? getHeader(event, "x-real-ip") ?? undefined
    const ua = getHeader(event, "user-agent") ?? undefined

    const { sessionToken } = await verifyPortalMagicLink(token, { ipAddress: ip, userAgent: ua })

    setCookie(event, "payiq_portal_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    })

    return sendRedirect(event, "/portal")
  } catch (err) {
    const errorMap: Record<string, string> = {
      INVALID_TOKEN: "invalid_token",
      TOKEN_USED: "token_used",
      TOKEN_EXPIRED: "token_expired",
      USER_INACTIVE: "inactive",
    }
    const code = err instanceof AppError ? (errorMap[err.code] ?? "error") : "error"
    return sendRedirect(event, `/portal/login?error=${code}`)
  }
})
