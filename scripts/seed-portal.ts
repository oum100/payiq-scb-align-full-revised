// scripts/seed-portal.ts
// สร้าง TenantUser สำหรับทดสอบ Portal login
// รัน: bun run scripts/seed-portal.ts

import { prisma } from "../server/lib/prisma"

const PORTAL_EMAIL = process.env.PORTAL_EMAIL ?? "merchant@payiq.local"
const PORTAL_NAME  = process.env.PORTAL_NAME  ?? "Demo Merchant"
const TENANT_CODE  = process.env.TENANT_CODE  ?? "demo"

async function main() {
  // หา tenant
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } })
  if (!tenant) {
    console.error(`✗ Tenant "${TENANT_CODE}" not found — run "bun run scripts/seed.ts" first`)
    process.exit(1)
  }

  console.log(`✓ Tenant found: ${tenant.name} (${tenant.code})`)

  // upsert TenantUser
  const user = await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: PORTAL_EMAIL } },
    update: { name: PORTAL_NAME, isActive: true, role: "OWNER" },
    create: {
      tenantId: tenant.id,
      email: PORTAL_EMAIL,
      name: PORTAL_NAME,
      role: "OWNER",
      isActive: true,
    },
  })

  console.log(`\n✅ Portal user ready:`)
  console.log(`   Email:  ${user.email}`)
  console.log(`   Name:   ${user.name}`)
  console.log(`   Role:   ${user.role}`)
  console.log(`   Tenant: ${tenant.name}`)
  console.log(`\n  👉 Go to http://localhost:3000/portal/login`)
  console.log(`     Enter: ${user.email}`)
  console.log(`     Magic link will be printed in console (no RESEND_API_KEY needed)\n`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
