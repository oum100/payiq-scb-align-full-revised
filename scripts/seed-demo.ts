/**
 * seed-demo.ts
 * สร้างข้อมูลตัวอย่างสำหรับ dev/demo
 *   - 3 tenants (acme, techhub, quickpay)
 *   - หลาย merchants ต่อ tenant
 *   - BillerProfile + PaymentRoute ต่อ tenant
 *   - TenantUser สำหรับ portal login
 *   - PaymentIntent หลาย statuses พร้อม PaymentEvents
 *
 * run: bun run scripts/seed-demo.ts
 */

import { prisma } from "../server/lib/prisma"
import { createApiKey } from "../server/services/auth/createApiKey"
import { nanoid } from "nanoid"

// ─── helpers ──────────────────────────────────────────────────────────────────

function publicId() {
  return `pi_${nanoid(20)}`
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(n: number) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

async function upsertTenant(code: string, name: string) {
  return prisma.tenant.upsert({
    where: { code },
    update: { name, status: "ACTIVE" },
    create: { code, name, status: "ACTIVE", defaultCurrency: "THB" },
  })
}

async function upsertMerchant(tenantId: string, code: string, name: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.merchantAccount.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { name, status: "ACTIVE", environment: env },
    create: { tenantId, code, name, status: "ACTIVE", environment: env, callbackBaseUrl: `https://${code}.example.com` },
  })
}

async function upsertBiller(tenantId: string, code: string, displayName: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.billerProfile.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { displayName, environment: env, status: "ACTIVE" },
    create: {
      tenantId, code, displayName,
      providerCode: "SCB",
      environment: env,
      billerId: `BILLER_${code.toUpperCase().replace(/-/g, "_")}`,
      merchantIdAtProvider: `MID_${code.toUpperCase().replace(/-/g, "_")}`,
      status: "ACTIVE",
      priority: 100,
      credentialsEncrypted: {
        clientId: process.env.SCB_CLIENT_ID ?? "mock-client-id",
        clientSecret: process.env.SCB_CLIENT_SECRET ?? "mock-client-secret",
      },
      config: {
        env: env === "LIVE" ? "production" : "sandbox",
        mode: "mock",
        apiBaseUrlV1: process.env.SCB_API_BASE_URL_V1 ?? "https://api-sandbox.partners.scb/partners/sandbox/v1",
        apiBaseUrlV2: process.env.SCB_API_BASE_URL_V2 ?? "https://api-sandbox.partners.scb/partners/sandbox/v2",
        apiKey: process.env.SCB_CLIENT_ID ?? "mock-key",
        apiSecret: process.env.SCB_CLIENT_SECRET ?? "mock-secret",
        callbackPrefix: "PYIQ",
        tokenPath: "/oauth/token",
        refreshTokenPath: "/oauth/token/refresh",
        createQrPath: "/payment/qrcode/create",
        inquiryPath: "/payment/billpayment/inquiry",
      },
    },
  })
}

async function upsertRoute(tenantId: string, code: string, billerProfileId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.paymentRoute.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { billerProfileId, status: "ACTIVE" },
    create: {
      tenantId, code,
      paymentMethodType: "PROMPTPAY_QR",
      providerCode: "SCB",
      environment: env,
      billerProfileId,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
  })
}

async function upsertTenantUser(tenantId: string, email: string, name: string, role: "OWNER" | "ADMIN" | "VIEWER" = "OWNER") {
  return prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId, email } },
    update: { name, role, isActive: true },
    create: { tenantId, email, name, role, isActive: true },
  })
}

async function upsertWebhookEndpoint(tenantId: string, merchantAccountId: string, code: string, url: string) {
  return prisma.webhookEndpoint.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { url, status: "ACTIVE" },
    create: {
      tenantId, merchantAccountId, code, url,
      status: "ACTIVE",
      subscribedEvents: ["PAYMENT_SUCCEEDED", "PAYMENT_FAILED", "PAYMENT_EXPIRED", "PAYMENT_CANCELLED", "PAYMENT_REVERSED", "PAYMENT_REFUNDED"],
      timeoutMs: 10000,
      maxAttempts: 10,
    },
  })
}

// สร้าง PaymentIntent + Events ใน 1 transaction
async function createPayment(params: {
  tenantId: string
  merchantAccountId: string
  billerProfileId: string
  routeId: string
  webhookEndpointId: string
  amount: number
  description: string
  status: string
  environment: "TEST" | "LIVE"
  customerName?: string
  createdAt?: Date
  merchantOrderId?: string
}) {
  const pid = publicId()
  const createdAt = params.createdAt ?? new Date()

  // กำหนด timestamps ตาม status
  const extra: Record<string, unknown> = {}
  if (params.status === "SUCCEEDED") {
    extra.succeededAt = new Date(createdAt.getTime() + 2 * 60 * 1000)
  } else if (params.status === "FAILED") {
    extra.failedAt = new Date(createdAt.getTime() + 5 * 60 * 1000)
    extra.failureReason = "Payment declined by provider"
    extra.lastErrorCode = "PROVIDER_REJECTED"
    extra.lastErrorMessage = "Transaction declined"
  } else if (params.status === "EXPIRED") {
    extra.expiredAt = new Date(createdAt.getTime() + 15 * 60 * 1000)
    extra.expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000)
  } else if (params.status === "CANCELLED") {
    extra.cancelledAt = new Date(createdAt.getTime() + 3 * 60 * 1000)
  } else if (params.status === "AWAITING_CUSTOMER") {
    extra.expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  } else if (params.status === "REVERSED") {
    extra.succeededAt = new Date(createdAt.getTime() + 2 * 60 * 1000)
    extra.failureReason = "Reversed by merchant request"
  } else if (params.status === "REFUNDED") {
    extra.succeededAt = new Date(createdAt.getTime() + 2 * 60 * 1000)
    extra.failureReason = "Refunded to customer"
  }

  const payment = await prisma.paymentIntent.create({
    data: {
      tenantId: params.tenantId,
      merchantAccountId: params.merchantAccountId,
      billerProfileId: params.billerProfileId,
      paymentRouteId: params.routeId,
      publicId: pid,
      merchantOrderId: params.merchantOrderId ?? `ORD-${nanoid(8).toUpperCase()}`,
      paymentMethodType: "PROMPTPAY_QR",
      providerCode: "SCB",
      environment: params.environment,
      currency: "THB",
      amount: params.amount,
      feeAmount: params.amount * 0.015,
      netAmount: params.amount * 0.985,
      status: params.status as any,
      version: 1,
      description: params.description,
      customerName: params.customerName ?? null,
      providerReference: `REF-${nanoid(12).toUpperCase()}`,
      providerTransactionId: !["CREATED","ROUTING"].includes(params.status) ? `TXN-${nanoid(16).toUpperCase()}` : null,
      qrPayload: ["AWAITING_CUSTOMER","SUCCEEDED","FAILED","EXPIRED","CANCELLED","REVERSED","REFUNDED","PROCESSING"].includes(params.status) ? `00020101021230${nanoid(20)}` : null,
      createdAt,
      updatedAt: createdAt,
      ...extra,
    },
  })

  // สร้าง PaymentEvents ตาม flow
  const events: Array<{
    type: string; fromStatus?: string; toStatus?: string; summary: string; createdAt: Date
  }> = [
    { type: "PAYMENT_CREATED", toStatus: "CREATED", summary: "Payment intent created", createdAt },
  ]

  if (!["CREATED"].includes(params.status)) {
    events.push({ type: "ROUTE_RESOLVED", fromStatus: "CREATED", toStatus: "ROUTING", summary: "Route resolved: SCB PromptPay QR", createdAt: new Date(createdAt.getTime() + 500) })
  }
  if (!["CREATED","ROUTING"].includes(params.status)) {
    events.push({ type: "PROVIDER_REQUESTED", fromStatus: "ROUTING", toStatus: "PENDING_PROVIDER", summary: "QR creation requested to SCB", createdAt: new Date(createdAt.getTime() + 1000) })
  }
  if (!["CREATED","ROUTING","PENDING_PROVIDER"].includes(params.status)) {
    events.push({ type: "PROVIDER_ACCEPTED", fromStatus: "PENDING_PROVIDER", toStatus: "AWAITING_CUSTOMER", summary: "QR generated, awaiting customer payment", createdAt: new Date(createdAt.getTime() + 2000) })
  }

  if (params.status === "SUCCEEDED") {
    events.push(
      { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB", createdAt: new Date(createdAt.getTime() + 90000) },
      { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed successful", createdAt: extra.succeededAt as Date },
      { type: "WEBHOOK_QUEUED", toStatus: "SUCCEEDED", summary: "Webhook queued for merchant notification", createdAt: new Date((extra.succeededAt as Date).getTime() + 100) },
      { type: "WEBHOOK_DELIVERED", toStatus: "SUCCEEDED", summary: "Webhook delivered to merchant endpoint", createdAt: new Date((extra.succeededAt as Date).getTime() + 500) },
    )
  } else if (params.status === "PROCESSING") {
    events.push(
      { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received, processing", createdAt: new Date(createdAt.getTime() + 90000) },
    )
  } else if (params.status === "FAILED") {
    events.push(
      { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received", createdAt: new Date(createdAt.getTime() + 60000) },
      { type: "PAYMENT_FAILED", fromStatus: "PROCESSING", toStatus: "FAILED", summary: "Payment failed: Transaction declined", createdAt: extra.failedAt as Date },
      { type: "WEBHOOK_QUEUED", toStatus: "FAILED", summary: "Webhook queued", createdAt: new Date((extra.failedAt as Date).getTime() + 100) },
      { type: "WEBHOOK_FAILED", toStatus: "FAILED", summary: "Webhook delivery failed: endpoint timeout", createdAt: new Date((extra.failedAt as Date).getTime() + 10500) },
    )
  } else if (params.status === "EXPIRED") {
    events.push(
      { type: "PAYMENT_EXPIRED", fromStatus: "AWAITING_CUSTOMER", toStatus: "EXPIRED", summary: "Payment QR expired after 15 minutes", createdAt: extra.expiredAt as Date },
    )
  } else if (params.status === "CANCELLED") {
    events.push(
      { type: "PAYMENT_CANCELLED", fromStatus: "AWAITING_CUSTOMER", toStatus: "CANCELLED", summary: "Payment cancelled by merchant", createdAt: extra.cancelledAt as Date },
    )
  } else if (params.status === "REVERSED") {
    const succeededAt = extra.succeededAt as Date
    events.push(
      { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received", createdAt: new Date(createdAt.getTime() + 90000) },
      { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed successful", createdAt: succeededAt },
      { type: "WEBHOOK_QUEUED", toStatus: "SUCCEEDED", summary: "Webhook queued", createdAt: new Date(succeededAt.getTime() + 100) },
      { type: "WEBHOOK_DELIVERED", toStatus: "SUCCEEDED", summary: "Webhook delivered", createdAt: new Date(succeededAt.getTime() + 500) },
      { type: "PAYMENT_REVERSED", fromStatus: "SUCCEEDED", toStatus: "REVERSED", summary: "Payment reversed by merchant request", createdAt: new Date(succeededAt.getTime() + 60 * 60 * 1000) },
    )
  } else if (params.status === "REFUNDED") {
    const succeededAt = extra.succeededAt as Date
    events.push(
      { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received", createdAt: new Date(createdAt.getTime() + 90000) },
      { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed successful", createdAt: succeededAt },
      { type: "WEBHOOK_QUEUED", toStatus: "SUCCEEDED", summary: "Webhook queued", createdAt: new Date(succeededAt.getTime() + 100) },
      { type: "WEBHOOK_DELIVERED", toStatus: "SUCCEEDED", summary: "Webhook delivered", createdAt: new Date(succeededAt.getTime() + 500) },
      { type: "PAYMENT_REFUNDED", fromStatus: "SUCCEEDED", toStatus: "REFUNDED", summary: "Payment refunded to customer", createdAt: new Date(succeededAt.getTime() + 2 * 60 * 60 * 1000) },
    )
  }

  await prisma.paymentEvent.createMany({
    data: events.map(e => ({
      paymentIntentId: payment.id,
      type: e.type as any,
      fromStatus: e.fromStatus as any ?? null,
      toStatus: e.toStatus as any ?? null,
      summary: e.summary,
      createdAt: e.createdAt,
    })),
  })

  // สร้าง ProviderAttempt สำหรับ payment ที่ผ่าน PENDING_PROVIDER ขึ้นไป
  if (!["CREATED", "ROUTING"].includes(params.status)) {
    const attemptAt = new Date(createdAt.getTime() + 1000)
    const isSuccess = !["FAILED"].includes(params.status)

    // Attempt 1: QR Create
    await prisma.providerAttempt.create({
      data: {
        paymentIntentId: payment.id,
        type: "CREATE_QR" as any,
        status: "SUCCEEDED" as any,
        httpStatusCode: 200,
        requestId: nanoid(32),
        billerProfileId: params.billerProfileId,
        providerCode: "SCB" as any,
        providerTxnId: payment.providerTransactionId,
        sentAt: attemptAt,
        completedAt: new Date(attemptAt.getTime() + 350),
        requestHeaders: {
          "Content-Type": "application/json",
          "Authorization": "Bearer <token>",
          "requestUId": nanoid(32),
          "resourceOwnerId": "scb-test-merchant",
        },
        requestBody: {
          qrType: "PP",
          ppType: "BILLERID",
          ppId: "010556833138901",
          amount: params.amount.toString(),
          ref1: payment.merchantOrderId,
          ref2: payment.publicId,
          ref3: "SCB",
        },
        responseHeaders: {
          "Content-Type": "application/json",
          "X-Request-ID": nanoid(32),
        },
        responseBody: {
          status: { code: "1000", description: "Success" },
          data: {
            qrRawData: payment.qrPayload ?? `00020101021230${nanoid(20)}`,
            qrImage: "base64encodedimage==",
            transactionId: payment.providerTransactionId ?? `TXN-${nanoid(16)}`,
          },
        },
        createdAt: attemptAt,
        updatedAt: new Date(attemptAt.getTime() + 350),
      },
    })

    // Attempt 2: Payment Inquiry (เฉพาะ payment ที่ได้รับ callback)
    if (["SUCCEEDED", "FAILED", "PROCESSING", "REVERSED", "REFUNDED"].includes(params.status)) {
      const inquiryAt = new Date(createdAt.getTime() + 92000)
      await prisma.providerAttempt.create({
        data: {
          paymentIntentId: payment.id,
          type: "INQUIRY" as any,
          status: isSuccess ? "SUCCEEDED" as any : "FAILED" as any,
          httpStatusCode: isSuccess ? 200 : 200,
          requestId: nanoid(32),
          billerProfileId: params.billerProfileId,
          providerCode: "SCB" as any,
          providerTxnId: payment.providerTransactionId,
          sentAt: inquiryAt,
          completedAt: new Date(inquiryAt.getTime() + 280),
          requestHeaders: {
            "Content-Type": "application/json",
            "Authorization": "Bearer <token>",
            "requestUId": nanoid(32),
          },
          requestBody: {
            transactionId: payment.providerTransactionId,
            sendingBank: "014",
          },
          responseHeaders: {
            "Content-Type": "application/json",
            "X-Correlation-ID": nanoid(24),
          },
          responseBody: isSuccess ? {
            status: { code: "1000", description: "Success" },
            data: {
              transRef: `REF${nanoid(10).toUpperCase()}`,
              sendingBank: "014",
              receivingBank: "014",
              transDate: createdAt.toISOString().split("T")[0].replace(/-/g, ""),
              transTime: createdAt.toTimeString().slice(0, 8).replace(/:/g, ""),
              sender: { name: params.customerName ?? "นาย ทดสอบ ระบบ", account: { value: "xxx-x-x1234-x" } },
              receiver: { name: "Acme Corp", account: { value: "010556833138901" } },
              amount: params.amount.toString(),
              paidLocalAmount: params.amount.toString(),
              ref1: payment.merchantOrderId,
              ref2: payment.publicId,
            },
          } : {
            status: { code: "4002", description: "Transaction not found" },
            data: null,
          },
          createdAt: inquiryAt,
          updatedAt: new Date(inquiryAt.getTime() + 280),
        },
      })
    }
  }

  // สร้าง WebhookDelivery สำหรับ payment ที่มี webhook events
  const WEBHOOK_STATUSES = ["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "REVERSED", "REFUNDED"]
  if (WEBHOOK_STATUSES.includes(params.status)) {
    const eventTypeMap: Record<string, string> = {
      SUCCEEDED: "PAYMENT_SUCCEEDED", FAILED: "PAYMENT_FAILED",
      EXPIRED: "PAYMENT_EXPIRED",     CANCELLED: "PAYMENT_CANCELLED",
      REVERSED: "PAYMENT_REVERSED",   REFUNDED: "PAYMENT_REFUNDED",
    }
    const webhookEventType = eventTypeMap[params.status]
    const isDelivered = ["SUCCEEDED", "REVERSED", "REFUNDED"].includes(params.status)
    const deliveryAt = extra.succeededAt ?? extra.failedAt ?? extra.expiredAt ?? extra.cancelledAt ?? new Date(createdAt.getTime() + 3 * 60 * 1000)
    const webhookAt = new Date((deliveryAt as Date).getTime() + 500)

    const mockPayload = {
      event: webhookEventType,
      paymentId: payment.publicId,
      merchantOrderId: payment.merchantOrderId,
      amount: params.amount,
      currency: "THB",
      status: params.status,
      providerReference: payment.providerReference,
      providerTransactionId: payment.providerTransactionId,
      timestamp: (deliveryAt as Date).toISOString(),
    }

    await prisma.webhookDelivery.create({
      data: {
        paymentIntentId: payment.id,
        webhookEndpointId: params.webhookEndpointId,
        eventType: webhookEventType as any,
        status: isDelivered ? "DELIVERED" as any : "DEAD" as any,
        attemptNumber: isDelivered ? 1 : 3,
        targetUrlSnapshot: "https://merchant.example.com/webhook/payiq",
        deliveredAt: isDelivered ? webhookAt : null,
        lastErrorAt: !isDelivered ? webhookAt : null,
        errorMessage: !isDelivered ? "HTTP 500: Internal Server Error after 3 attempts" : null,
        requestHeaders: {
          "Content-Type": "application/json",
          "X-PayIQ-Signature": `sha256=${nanoid(64)}`,
          "X-PayIQ-Event": webhookEventType,
          "User-Agent": "PayIQ-Webhook/1.0",
        },
        requestBody: mockPayload,
        responseStatusCode: isDelivered ? 200 : 500,
        responseHeaders: isDelivered ? { "Content-Type": "application/json" } : { "Content-Type": "text/html" },
        responseBody: isDelivered ? { received: true } : { error: "Internal Server Error" },
        idempotencyKey: `${payment.publicId}-${webhookEventType}`,
        createdAt: new Date((deliveryAt as Date).getTime() + 100),
        updatedAt: webhookAt,
      },
    })
  }

  return payment
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding demo data...")

  // ── Clean up payment-related data ก่อน seed ใหม่ทุกครั้ง ──────────────────
  console.log("🧹 Cleaning existing payment data...")
  await prisma.webhookDelivery.deleteMany({})
  await prisma.providerCallback.deleteMany({})
  await prisma.providerAttempt.deleteMany({})
  await prisma.paymentEvent.deleteMany({})
  await prisma.paymentIntent.deleteMany({})
  console.log("   ✓ Cleared")

  // ══════════════════════════════════════════════════════════════
  // TENANT 1: Acme Corp — E-Commerce, 2 merchants
  // ══════════════════════════════════════════════════════════════
  console.log("\n📦 Tenant: Acme Corp")
  const acme = await upsertTenant("acme", "Acme Corp")
  const acmeStore = await upsertMerchant(acme.id, "acme-store", "Acme Online Store")
  const acmeB2B = await upsertMerchant(acme.id, "acme-b2b", "Acme B2B Portal")
  const acmeBiller = await upsertBiller(acme.id, "scb-test", "SCB PromptPay (TEST)")
  const acmeRoute = await upsertRoute(acme.id, "promptpay-test", acmeBiller.id)
  const acmeStoreWebhook = await upsertWebhookEndpoint(acme.id, acmeStore.id, "acme-store-wh", "https://acme-store.example.com/webhook/payiq")
  const acmeB2BWebhook = await upsertWebhookEndpoint(acme.id, acmeB2B.id, "acme-b2b-wh", "https://acme-b2b.example.com/webhook/payiq")

  await upsertTenantUser(acme.id, "owner@acme.com", "Alice Smith", "OWNER")
  await upsertTenantUser(acme.id, "dev@acme.com", "Bob Jones", "ADMIN")
  await upsertTenantUser(acme.id, "finance@acme.com", "Carol Wu", "VIEWER")

  // Acme payments — ครบทุก status
  const acmePayments = [
    { amount: 1500,  status: "SUCCEEDED",         desc: "Order #A001 - iPhone Case",         merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 14, customer: "สมชาย ใจดี" },
    { amount: 3200,  status: "SUCCEEDED",         desc: "Order #A002 - Wireless Earbuds",    merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 13, customer: "สมหญิง รักสวย" },
    { amount: 890,   status: "SUCCEEDED",         desc: "Order #A003 - Phone Charger",       merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 12, customer: "วิชัย มานะ" },
    { amount: 25000, status: "SUCCEEDED",         desc: "Invoice #B001 - Software License",  merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 11, customer: "บริษัท เทคไทย จำกัด" },
    { amount: 4500,  status: "FAILED",            desc: "Order #A004 - Smart Watch",         merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 10, customer: "ประยุทธ์ ขยัน" },
    { amount: 1200,  status: "EXPIRED",           desc: "Order #A005 - Laptop Stand",        merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 9,  customer: "อนงค์ สวยงาม" },
    { amount: 75000, status: "SUCCEEDED",         desc: "Invoice #B002 - Annual Support",    merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 8,  customer: "บริษัท ดิจิทัล จำกัด" },
    { amount: 2800,  status: "SUCCEEDED",         desc: "Order #A006 - Gaming Mouse",        merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 7,  customer: "ธีรวัฒน์ เก่ง" },
    { amount: 560,   status: "CANCELLED",         desc: "Order #A007 - USB Hub",             merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 6,  customer: "มาลี สดใส" },
    { amount: 12000, status: "FAILED",            desc: "Invoice #B003 - Consulting Fee",    merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 5,  customer: "บริษัท คอนซัลท์ จำกัด" },
    { amount: 3600,  status: "SUCCEEDED",         desc: "Order #A008 - Mechanical Keyboard", merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 4,  customer: "ณัฐพล ฉลาด" },
    { amount: 990,   status: "SUCCEEDED",         desc: "Order #A009 - Mouse Pad",           merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 3,  customer: "พรทิพย์ น่ารัก" },
    { amount: 18500, status: "SUCCEEDED",         desc: "Invoice #B004 - Hardware Setup",    merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 2,  customer: "บริษัท ไอที โซลูชัน จำกัด" },
    { amount: 2100,  status: "AWAITING_CUSTOMER", desc: "Order #A010 - Webcam",              merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 0,  customer: "สุภาพ ยิ้มแย้ม" },
    { amount: 45000, status: "AWAITING_CUSTOMER", desc: "Invoice #B005 - Cloud Migration",   merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 0,  customer: "บริษัท คลาวด์ ไทย จำกัด" },
    { amount: 550,   status: "CREATED",           desc: "Order #A011 - Phone Stand",         merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 0,  customer: "ลูกค้าใหม่ ทดสอบ" },
    { amount: 1100,  status: "ROUTING",           desc: "Order #A012 - Tablet Case",         merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 0,  customer: "ลูกค้า Routing" },
    { amount: 3300,  status: "PENDING_PROVIDER",  desc: "Invoice #B006 - Dev Tools",         merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 0,  customer: "บริษัท DevCo จำกัด" },
    { amount: 7800,  status: "PROCESSING",        desc: "Invoice #B007 - Cloud Storage",     merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 0,  customer: "บริษัท Cloud จำกัด" },
    { amount: 9900,  status: "REVERSED",          desc: "Order #A013 - Premium Headset",     merchant: acmeStore, webhook: acmeStoreWebhook, daysBack: 5,  customer: "มานพ คืนเงิน" },
    { amount: 15000, status: "REFUNDED",          desc: "Invoice #B008 - Wrong Invoice",     merchant: acmeB2B,   webhook: acmeB2BWebhook,   daysBack: 3,  customer: "บริษัท ขอคืน จำกัด" },
  ]

  for (const p of acmePayments) {
    await createPayment({
      tenantId: acme.id,
      merchantAccountId: p.merchant.id,
      billerProfileId: acmeBiller.id,
      routeId: acmeRoute.id,
      webhookEndpointId: p.webhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
    })
  }
  console.log(`  ✅ ${acmePayments.length} payments created`)

  // ══════════════════════════════════════════════════════════════
  // TENANT 2: TechHub — SaaS, มี TEST + LIVE biller
  // ══════════════════════════════════════════════════════════════
  console.log("\n🚀 Tenant: TechHub")
  const techhub = await upsertTenant("techhub", "TechHub Co., Ltd.")
  const techhubMain = await upsertMerchant(techhub.id, "techhub-saas", "TechHub SaaS Platform")
  const techhubBillerTest = await upsertBiller(techhub.id, "scb-test", "SCB PromptPay (TEST)", "TEST")
  const techhubBillerLive = await upsertBiller(techhub.id, "scb-live", "SCB PromptPay (LIVE)", "LIVE")
  const techhubRouteTest = await upsertRoute(techhub.id, "promptpay-test", techhubBillerTest.id, "TEST")
  const techhubRouteLive = await upsertRoute(techhub.id, "promptpay-live", techhubBillerLive.id, "LIVE")
  const techhubWebhook = await upsertWebhookEndpoint(techhub.id, techhubMain.id, "techhub-wh", "https://techhub.co.th/webhook/payiq")

  await upsertTenantUser(techhub.id, "ceo@techhub.co.th", "David Chen", "OWNER")
  await upsertTenantUser(techhub.id, "ops@techhub.co.th", "Emma Lee", "ADMIN")

  // TechHub TEST payments
  const techhubTestPayments = [
    { amount: 299,   status: "SUCCEEDED",        desc: "Starter Plan - Monthly",    biller: techhubBillerTest, route: techhubRouteTest, env: "TEST" as const, daysBack: 20, customer: "ทดสอบ ระบบ" },
    { amount: 299,   status: "FAILED",           desc: "Starter Plan - Monthly",    biller: techhubBillerTest, route: techhubRouteTest, env: "TEST" as const, daysBack: 18, customer: "ทดสอบ ระบบ 2" },
    { amount: 299,   status: "SUCCEEDED",        desc: "Starter Plan - Monthly",    biller: techhubBillerTest, route: techhubRouteTest, env: "TEST" as const, daysBack: 15, customer: "ทดสอบ ระบบ 3" },
    { amount: 990,   status: "SUCCEEDED",        desc: "Pro Plan - Monthly",        biller: techhubBillerTest, route: techhubRouteTest, env: "TEST" as const, daysBack: 10, customer: "สมชาย ทดสอบ" },
    { amount: 2990,  status: "AWAITING_CUSTOMER",desc: "Enterprise Plan - Monthly", biller: techhubBillerTest, route: techhubRouteTest, env: "TEST" as const, daysBack: 0,  customer: "ทดสอบ Enterprise" },
  ]

  // TechHub LIVE payments — real transactions
  const techhubLivePayments = [
    { amount: 299,   status: "SUCCEEDED", desc: "Starter Plan - Jan 2025",    biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 30, customer: "นายกิตติ วัฒนะ" },
    { amount: 299,   status: "SUCCEEDED", desc: "Starter Plan - Feb 2025",    biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 20, customer: "นายกิตติ วัฒนะ" },
    { amount: 990,   status: "SUCCEEDED", desc: "Pro Plan - Jan 2025",        biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 28, customer: "นางสาวพิมพ์ใจ บุญมี" },
    { amount: 990,   status: "SUCCEEDED", desc: "Pro Plan - Feb 2025",        biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 18, customer: "นางสาวพิมพ์ใจ บุญมี" },
    { amount: 2990,  status: "SUCCEEDED", desc: "Enterprise Plan - Jan 2025", biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 27, customer: "บริษัท ไฟแนนซ์ จำกัด" },
    { amount: 2990,  status: "FAILED",    desc: "Enterprise Plan - Feb 2025", biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 17, customer: "บริษัท ไฟแนนซ์ จำกัด" },
    { amount: 2990,  status: "SUCCEEDED", desc: "Enterprise Plan - Feb 2025 (retry)", biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 16, customer: "บริษัท ไฟแนนซ์ จำกัด" },
    { amount: 299,   status: "EXPIRED",   desc: "Starter Plan - Mar 2025",    biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 5,  customer: "นายเปรม สุขสันต์" },
    { amount: 990,   status: "AWAITING_CUSTOMER", desc: "Pro Plan - Apr 2025", biller: techhubBillerLive, route: techhubRouteLive, env: "LIVE" as const, daysBack: 0, customer: "นางสาวกัลยา ดีใจ" },
  ]

  for (const p of [...techhubTestPayments, ...techhubLivePayments]) {
    await createPayment({
      tenantId: techhub.id,
      merchantAccountId: techhubMain.id,
      billerProfileId: p.biller.id,
      routeId: p.route.id,
      webhookEndpointId: techhubWebhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: p.env,
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
    })
  }
  console.log(`  ✅ ${techhubTestPayments.length} TEST + ${techhubLivePayments.length} LIVE payments created`)

  // ══════════════════════════════════════════════════════════════
  // TENANT 3: QuickPay — Payment Aggregator, 2 merchants
  // ══════════════════════════════════════════════════════════════
  console.log("\n💳 Tenant: QuickPay")
  const quickpay = await upsertTenant("quickpay", "QuickPay Solutions")
  const qpRetail = await upsertMerchant(quickpay.id, "qp-retail", "QuickPay Retail")
  const qpFood = await upsertMerchant(quickpay.id, "qp-food", "QuickPay Food & Beverage")
  const qpBiller = await upsertBiller(quickpay.id, "scb-test", "SCB PromptPay (TEST)")
  const qpRoute = await upsertRoute(quickpay.id, "promptpay-test", qpBiller.id)
  const qpRetailWebhook = await upsertWebhookEndpoint(quickpay.id, qpRetail.id, "qp-retail-wh", "https://quickpay.th/webhook/retail")
  const qpFoodWebhook = await upsertWebhookEndpoint(quickpay.id, qpFood.id, "qp-food-wh", "https://quickpay.th/webhook/food")

  await upsertTenantUser(quickpay.id, "admin@quickpay.th", "Frank Tan", "OWNER")

  const qpPayments = [
    { amount: 150,  status: "SUCCEEDED",        desc: "Coffee & Pastry",     merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 7,  customer: "ลูกค้า A" },
    { amount: 320,  status: "SUCCEEDED",        desc: "Lunch Set x2",        merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 7,  customer: "ลูกค้า B" },
    { amount: 1800, status: "SUCCEEDED",        desc: "Grocery Shopping",    merchant: qpRetail, webhook: qpRetailWebhook, daysBack: 6,  customer: "สุดา ขายดี" },
    { amount: 75,   status: "FAILED",           desc: "Snack Box",           merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 6,  customer: "ลูกค้า C" },
    { amount: 450,  status: "SUCCEEDED",        desc: "Dinner for 3",        merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 5,  customer: "ลูกค้า D" },
    { amount: 2500, status: "SUCCEEDED",        desc: "Electronics",         merchant: qpRetail, webhook: qpRetailWebhook, daysBack: 5,  customer: "วิโรจน์ ซื้อของ" },
    { amount: 180,  status: "EXPIRED",          desc: "Breakfast Set",       merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 4,  customer: "ลูกค้า E" },
    { amount: 3200, status: "SUCCEEDED",        desc: "Home Appliance",      merchant: qpRetail, webhook: qpRetailWebhook, daysBack: 3,  customer: "ปิยะ บ้านสวย" },
    { amount: 95,   status: "SUCCEEDED",        desc: "Afternoon Tea",       merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 2,  customer: "ลูกค้า F" },
    { amount: 620,  status: "SUCCEEDED",        desc: "Weekend Groceries",   merchant: qpRetail, webhook: qpRetailWebhook, daysBack: 1,  customer: "แม่บ้าน ดี" },
    { amount: 280,  status: "AWAITING_CUSTOMER",desc: "Lunch Today",         merchant: qpFood,   webhook: qpFoodWebhook,   daysBack: 0,  customer: "ลูกค้า G" },
    { amount: 4500, status: "AWAITING_CUSTOMER",desc: "Big Purchase",        merchant: qpRetail, webhook: qpRetailWebhook, daysBack: 0,  customer: "นาย ใหม่ ซื้อ" },
  ]

  for (const p of qpPayments) {
    await createPayment({
      tenantId: quickpay.id,
      merchantAccountId: p.merchant.id,
      billerProfileId: qpBiller.id,
      routeId: qpRoute.id,
      webhookEndpointId: p.webhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
    })
  }
  console.log(`  ✅ ${qpPayments.length} payments created`)

  // ══════════════════════════════════════════════════════════════
  // API Keys
  // ══════════════════════════════════════════════════════════════
  console.log("\n🔑 Creating API Keys...")

  const keysToCreate = [
    { tenantCode: "acme",     merchantCode: "acme-store", name: "Acme Store TEST Key",    env: "TEST" as const },
    { tenantCode: "acme",     merchantCode: "acme-b2b",   name: "Acme B2B TEST Key",      env: "TEST" as const },
    { tenantCode: "techhub",  merchantCode: "techhub-saas", name: "TechHub TEST Key",     env: "TEST" as const },
    { tenantCode: "techhub",  merchantCode: "techhub-saas", name: "TechHub LIVE Key",     env: "LIVE" as const },
    { tenantCode: "quickpay", merchantCode: "qp-retail",  name: "QuickPay Retail Key",    env: "TEST" as const },
    { tenantCode: "quickpay", merchantCode: "qp-food",    name: "QuickPay Food & Bev Key", env: "TEST" as const },
  ]

  const createdKeys: string[] = []
  for (const k of keysToCreate) {
    try {
      const result = await createApiKey({
        tenantCode: k.tenantCode,
        merchantCode: k.merchantCode,
        name: k.name,
        scopes: ["payments:create", "payments:read", "api_keys:manage"],
        environment: k.env,
      })
      createdKeys.push(`  ${k.name}: ${result.fullKey}`)
    } catch {
      createdKeys.push(`  ${k.name}: (already exists, skipped)`)
    }
  }

  // ══════════════════════════════════════════════════════════════
  // สรุป
  // ══════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60))
  console.log("✅ Demo seed completed!")
  console.log("═".repeat(60))
  console.log("\nTenants created:")
  console.log("  • acme      — Acme Corp (E-Commerce) — 2 merchants, 15 payments")
  console.log("  • techhub   — TechHub Co. (SaaS)     — 1 merchant, TEST + LIVE billers, 14 payments")
  console.log("  • quickpay  — QuickPay Solutions      — 2 merchants, 12 payments")
  console.log("\nPortal login emails:")
  console.log("  • owner@acme.com     (OWNER)")
  console.log("  • dev@acme.com       (ADMIN)")
  console.log("  • finance@acme.com   (VIEWER)")
  console.log("  • ceo@techhub.co.th  (OWNER)")
  console.log("  • ops@techhub.co.th  (ADMIN)")
  console.log("  • admin@quickpay.th  (OWNER)")
  console.log("\n⚠️  API Keys (save now — not shown again):")
  createdKeys.forEach(k => console.log(k))
  console.log("═".repeat(60))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
