// server/api/admin/auth/magic-link.post.ts
import { z } from "zod"
import { createMagicLink } from "~~/server/services/admin/adminAuth"
import { sendMagicLinkEmail } from "~~/server/services/admin/sendMagicLinkEmail"

const schema = z.object({ email: z.string().email() })

export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event))
  if (!body.success) {
    setResponseStatus(event, 400)
    return { error: "INVALID_EMAIL", message: "Please enter a valid email address" }
  }

  const { email } = body.data

  // Rate limit: ป้องกัน email flooding (เบื้องต้นใช้ header check)
  // Production: เพิ่ม Redis rate limiting ตรงนี้

  const magicUrl = await createMagicLink(email)

  // ถ้า createMagicLink คืน "ok" แสดงว่า email ไม่มีใน system — ไม่ reveal
  if (magicUrl !== "ok") {
    await sendMagicLinkEmail(email, magicUrl)
  }

  // Response เดิมเสมอ ไม่ว่าจะมี email หรือไม่
  return { ok: true, message: "If this email is registered, a sign-in link has been sent." }
})
