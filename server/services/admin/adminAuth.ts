import { randomBytes } from "node:crypto"
import { prisma } from "~~/server/lib/prisma"
import { sha256 } from "~~/server/lib/crypto"
import { AppError } from "~~/server/lib/errors"

const MAGIC_LINK_TTL_MIN = 15
const SESSION_TTL_DAYS = 7

// ─── Generate & store magic link ────────────────────────────────────────────

export async function createMagicLink(email: string): Promise<string> {
  const admin = await prisma.adminUser.findUnique({ where: { email } })

  // ไม่ reveal ว่า email มีหรือไม่ (security) — return ok เสมอ
  if (!admin || !admin.isActive) {
    return "ok"
  }

  const token = randomBytes(32).toString("hex")
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MIN * 60 * 1000)

  // ลบ magic links เก่าของ admin นี้ก่อน
  await prisma.adminMagicLink.deleteMany({ where: { adminId: admin.id } })

  await prisma.adminMagicLink.create({
    data: { adminId: admin.id, tokenHash, expiresAt },
  })

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  const magicUrl = `${baseUrl}/admin/auth/callback?token=${token}`

  return magicUrl
}

// ─── Verify token → create session ──────────────────────────────────────────

export async function verifyMagicLink(
  token: string,
  meta: { ipAddress?: string; userAgent?: string }
): Promise<{ sessionToken: string; admin: { id: string; email: string; name: string | null } }> {
  const tokenHash = sha256(token)

  const link = await prisma.adminMagicLink.findUnique({ where: { tokenHash } })

  if (!link) throw new AppError("INVALID_TOKEN", "Invalid or expired link", 401)
  if (link.usedAt) throw new AppError("TOKEN_USED", "This link has already been used", 401)
  if (link.expiresAt < new Date()) throw new AppError("TOKEN_EXPIRED", "Link has expired", 401)

  const admin = await prisma.adminUser.findUnique({ where: { id: link.adminId } })
  if (!admin || !admin.isActive) throw new AppError("ADMIN_INACTIVE", "Account is inactive", 403)

  // Mark used
  await prisma.adminMagicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } })

  // Create session
  const sessionToken = randomBytes(32).toString("hex")
  const sessionHash = sha256(sessionToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      sessionHash,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  })

  // Update lastLoginAt
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })

  return { sessionToken, admin: { id: admin.id, email: admin.email, name: admin.name } }
}

// ─── Resolve session from cookie ─────────────────────────────────────────────

export async function resolveAdminSession(
  sessionToken: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const sessionHash = sha256(sessionToken)

  const session = await prisma.adminSession.findUnique({
    where: { sessionHash },
    include: { admin: { select: { id: true, email: true, name: true, isActive: true } } },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (!session.admin.isActive) return null

  return { id: session.admin.id, email: session.admin.email, name: session.admin.name }
}

// ─── Revoke session (logout) ─────────────────────────────────────────────────

export async function revokeAdminSession(sessionToken: string): Promise<void> {
  const sessionHash = sha256(sessionToken)
  await prisma.adminSession.deleteMany({ where: { sessionHash } })
}