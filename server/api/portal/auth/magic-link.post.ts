// server/api/portal/auth/magic-link.post.ts
import { z } from "zod"
import { createPortalMagicLink } from "~~/server/services/portal/portalAuth"
import { sendPortalMagicLink } from "~~/server/services/portal/sendPortalMagicLink"
import { prisma } from "~~/server/lib/prisma"

const schema = z.object({ email: z.string().email() })

export default defineEventHandler(async (event) => {
  const body = schema.safeParse(await readBody(event))
  if (!body.success) {
    setResponseStatus(event, 400)
    return { error: "INVALID_EMAIL", message: "Please enter a valid email address" }
  }

  const { email } = body.data
  const magicUrl = await createPortalMagicLink(email)

  if (magicUrl !== "ok") {
    // หา tenant name สำหรับใส่ใน email
    const user = await prisma.tenantUser.findFirst({
      where: { email, isActive: true },
      include: { tenant: { select: { name: true } } },
    })
    const tenantName = user?.tenant?.name ?? "PayIQ"
    await sendPortalMagicLink(email, magicUrl, tenantName)
  }

  return { ok: true, message: "If this email is registered, a sign-in link has been sent." }
})
