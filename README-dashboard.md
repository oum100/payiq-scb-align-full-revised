# PayIQ Dashboard — Setup Guide

## สิ่งที่สร้างใหม่ทั้งหมด

```
payiq-dashboard/
├── prisma/
│   ├── migrations/20260405000000_add_admin_auth/migration.sql  ← run ก่อน
│   └── schema-additions.prisma   ← เพิ่มต่อท้าย schema.prisma
│
├── server/
│   ├── middleware/
│   │   └── 30.admin-auth.ts      ← ป้องกัน /admin/* ทุก route
│   ├── services/admin/
│   │   ├── adminAuth.ts          ← magic link + session logic
│   │   └── sendMagicLinkEmail.ts ← Resend email sender
│   └── api/
│       ├── admin/auth/
│       │   ├── magic-link.post.ts
│       │   ├── verify.get.ts
│       │   ├── logout.post.ts
│       │   └── me.get.ts
│       ├── admin/dashboard/stats.get.ts
│       ├── admin/payments/index.get.ts
│       ├── admin/payments/[publicId].get.ts
│       ├── admin/merchants/index.get.ts
│       ├── admin/users/index.get.ts
│       ├── admin/users/index.post.ts
│       └── admin/users/[id].patch.ts
│       └── internal/callbacks/index.get.ts
│
├── app/
│   ├── layouts/admin.vue          ← sidebar layout
│   ├── middleware/admin-auth.ts   ← client-side route guard
│   ├── composables/useAdmin.ts
│   └── pages/admin/
│       ├── login.vue
│       ├── index.vue              ← dashboard overview
│       ├── payments/index.vue
│       ├── payments/[publicId].vue
│       ├── callbacks/index.vue
│       ├── webhooks/index.vue
│       ├── queues/index.vue
│       ├── merchants/index.vue
│       ├── api-keys/index.vue
│       └── users/index.vue
│
└── scripts/seed-admin.ts
```

---

## ขั้นตอน Setup

### 1. เพิ่ม env vars ใน `.env`

```env
# ─── Dashboard Auth ───────────────────────────────────────────
RESEND_API_KEY="re_xxxxxxxxxxxx"          # จาก resend.com (ถ้าไม่มี magic link จะ log ใน console)
RESEND_FROM="PayIQ <noreply@yourdomain.com>"
ADMIN_EMAIL="admin@yourcompany.com"       # สำหรับ seed-admin script
ADMIN_NAME="Your Name"
```

### 2. ติดตั้ง Resend SDK

```bash
bun add resend
```

> หมายเหตุ: ใน `sendMagicLinkEmail.ts` ใช้ `fetch` โดยตรงแล้ว ไม่จำเป็นต้อง install SDK ก็ได้

### 3. Run migration

```bash
# copy migration file ไปใส่ prisma/migrations/
# แล้ว run:
bun prisma migrate deploy
# หรือ dev:
bun prisma migrate dev
```

### 4. เพิ่ม models ใน schema.prisma

Copy เนื้อหาจาก `schema-additions.prisma` ต่อท้าย `prisma/schema.prisma`
แล้ว run:
```bash
bun prisma generate
```

### 5. Seed admin user คนแรก

```bash
ADMIN_EMAIL="you@company.com" ADMIN_NAME="Your Name" bun run scripts/seed-admin.ts
```

### 6. เพิ่ม script ใน `package.json`

```json
{
  "scripts": {
    "seed:admin": "bun run scripts/seed-admin.ts"
  }
}
```

### 7. Start dev server

```bash
bun run dev
```

ไปที่ `http://localhost:3000/admin/login` → กรอก email → magic link จะ **print ใน terminal** (ถ้ายังไม่ได้ set RESEND_API_KEY)

---

## Pages ที่มี

| URL | หน้า |
|-----|------|
| `/admin/login` | หน้า login magic link |
| `/admin` | Dashboard overview + stats + chart |
| `/admin/payments` | รายการ payment ทั้งหมด + filter |
| `/admin/payments/:publicId` | Payment detail + event timeline |
| `/admin/callbacks` | Provider callbacks monitor |
| `/admin/webhooks` | Webhook delivery list |
| `/admin/queues` | BullMQ queue health |
| `/admin/merchants` | จัดการ merchant accounts |
| `/admin/api-keys` | จัดการ API keys + สร้างใหม่ |
| `/admin/users` | จัดการ admin users |

---

## Security design

- **Magic link** หมดอายุใน 15 นาที + ใช้ได้ครั้งเดียว
- **Session** เก็บเป็น `httpOnly` cookie, hash ใน DB, อายุ 7 วัน
- **Server middleware** (`30.admin-auth.ts`) block ทุก `/admin/*` request ก่อนถึง handler
- **Email enumeration protection** — response เดิมเสมอ ไม่ว่า email จะมีหรือไม่
- **Self-deactivation protection** — ป้องกันไม่ให้ deactivate ตัวเอง
- Session ถูก revoke ทันทีเมื่อ admin ถูก deactivate

---

## สิ่งที่ยังต้องทำต่อ (next steps)

- [ ] Tenant/Biller profile management pages
- [ ] Reconciliation records viewer
- [ ] Webhook endpoint management (create/edit URL + events)
- [ ] Payment manual actions (refund, cancel)
- [ ] Revenue metrics page ที่มี chart สวยขึ้น (ใช้ Chart.js หรือ recharts)
- [ ] Rate limiting สำหรับ magic link request (Redis-based)
- [ ] Email template ที่สวยขึ้น (ตอนนี้ inline HTML แล้ว)
- [ ] Audit log viewer
