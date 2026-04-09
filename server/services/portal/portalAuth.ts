// server/services/portal/portalAuth.ts
import { randomBytes } from "node:crypto"
import { prisma } from "~~/server/lib/prisma"
import { sha256 } from "~~/server/lib/crypto"
import { AppError } from "~~/server/lib/errors"

const MAGIC_LINK_TTL_MIN = 15
const SESSION_TTL_DAYS = 7

// ─── Generate magic link ──────────────────────────────────────────────────────

export async function createPortalMagicLink(email: string): Promise<string> {
  // หา TenantUser จาก email (email unique ข้าม tenants ไม่ได้ — หาตัวแรกที่ active)
  const user = await prisma.tenantUser.findFirst({
    where: { email, isActive: true },
    include: { tenant: { select: { status: true } } },
  })

  if (!user || user.tenant.status !== "ACTIVE") return "ok"

  const token = randomBytes(32).toString("hex")
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000)

  await prisma.tenantMagicLink.deleteMany({ where: { userId: user.id } })
  await prisma.tenantMagicLink.create({ data: { userId: user.id, tokenHash, expiresAt } })

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  return `${baseUrl}/portal/auth/callback?token=${token}`
}

// ─── Verify token → session ───────────────────────────────────────────────────

export async function verifyPortalMagicLink(
  token: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<{
  sessionToken: string
  user: { id: string; email: string; name: string | null; tenantId: string; role: string }
}> {
  const tokenHash = sha256(token)
  const link = await prisma.tenantMagicLink.findUnique({ where: { tokenHash } })

  if (!link) throw new AppError("INVALID_TOKEN", "Invalid or expired link", 401)
  if (link.usedAt) throw new AppError("TOKEN_USED", "Link already used", 401)
  if (link.expiresAt < new Date()) throw new AppError("TOKEN_EXPIRED", "Link expired", 401)

  const user = await prisma.tenantUser.findUnique({
    where: { id: link.userId },
    include: { tenant: { select: { status: true } } },
  })
  if (!user || !user.isActive || user.tenant.status !== "ACTIVE") {
    throw new AppError("USER_INACTIVE", "Account is inactive", 403)
  }

  await prisma.tenantMagicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } })

  const sessionToken = randomBytes(32).toString("hex")
  const sessionHash = sha256(sessionToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await prisma.tenantSession.create({
    data: { userId: user.id, sessionHash, expiresAt, ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent ?? null },
  })
  await prisma.tenantUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  return {
    sessionToken,
    user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, role: user.role },
  }
}

// ─── Resolve session ──────────────────────────────────────────────────────────

export async function resolvePortalSession(sessionToken: string): Promise<{
  id: string; email: string; name: string | null; tenantId: string; role: string; tenantName: string
} | null> {
  const sessionHash = sha256(sessionToken)
  const session = await prisma.tenantSession.findUnique({
    where: { sessionHash },
    include: {
      user: {
        select: { id: true, email: true, name: true, tenantId: true, role: true, isActive: true,
          tenant: { select: { name: true, status: true } } },
      },
    },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.tenantSession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.user.isActive || session.user.tenant.status !== "ACTIVE") return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    tenantId: session.user.tenantId,
    role: session.user.role,
    tenantName: session.user.tenant.name,
  }
}

// ─── Revoke session ───────────────────────────────────────────────────────────

export async function revokePortalSession(sessionToken: string): Promise<void> {
  const sessionHash = sha256(sessionToken)
  await prisma.tenantSession.deleteMany({ where: { sessionHash } })
}
