// scripts/seed-admin.ts
// รัน: bun run scripts/seed-admin.ts
// สร้าง admin user คนแรกสำหรับ dashboard

import { prisma } from "../server/lib/prisma"

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@payiq.local"
const ADMIN_NAME  = process.env.ADMIN_NAME  ?? "Admin"

async function main() {
  const existing = await prisma.adminUser.findUnique({ where: { email: ADMIN_EMAIL } })

  if (existing) {
    console.log(`✓ Admin already exists: ${existing.email}`)
    return
  }

  const admin = await prisma.adminUser.create({
    data: { email: ADMIN_EMAIL, name: ADMIN_NAME, isActive: true },
  })

  console.log(`✓ Created admin user:`)
  console.log(`   Email: ${admin.email}`)
  console.log(`   Name:  ${admin.name}`)
  console.log(`\n  Go to http://localhost:3000/admin/login and enter this email`)
  console.log(`  to receive a magic link (printed in console if RESEND_API_KEY is not set)\n`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
