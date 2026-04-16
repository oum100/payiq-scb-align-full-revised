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

/**
 * SlipOK verifier biller — providerCode = THAI_QR (QR generator)
 * slipVerifier = "SLIPOK" stored in config, API key in credentialsEncrypted
 * Each tenant registers their own SlipOK account and stores the key here.
 */
async function upsertSlipOkBiller(tenantId: string, code: string, displayName: string, promptpayId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.billerProfile.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { displayName, environment: env, status: "ACTIVE" },
    create: {
      tenantId, code, displayName,
      providerCode: "THAI_QR",           // ← QR generator
      environment: env,
      billerId: null,
      merchantIdAtProvider: null,
      status: "ACTIVE",
      priority: 100,
      credentialsEncrypted: {
        slipokApiKey: process.env.SLIPOK_API_KEY ?? "mock-slipok-key",  // tenant's own key
      },
      config: {
        mock: true,
        // Receiving account (QR points to this account)
        promptpayIdType: "mobile",
        promptpayId,
        merchantName: displayName.slice(0, 25),
        merchantCity: "Bangkok",
        // Slip verifier
        slipVerifier: "SLIPOK",
        slipokApiBaseUrl: process.env.SLIPOK_API_BASE_URL ?? "https://api.slipok.com/api/line/apikey",
        slipokBranchCode: "0",
      },
    },
  })
}

async function upsertSlipOkRoute(tenantId: string, code: string, billerProfileId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.paymentRoute.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { billerProfileId, status: "ACTIVE" },
    create: {
      tenantId, code,
      paymentMethodType: "BANK_TRANSFER_SLIP",
      providerCode: "THAI_QR",           // ← always THAI_QR
      environment: env,
      billerProfileId,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
  })
}

/**
 * MaeMaNee biller — uses THAI_QR provider with promptpayIdType = "maeMaNee"
 * QR is built via PROMPTPAY_BILL_PAYMENT with fixed billerID + ref1 (shop code) + ref2 (order) + terminalID.
 * No slip verifier — merchant confirms payment via MaeMaNee dashboard or own webhook.
 */
async function upsertMaeManeeBiller(
  tenantId: string, code: string, displayName: string,
  opts: {
    maeManeeBillerId: string
    maeManeeRef1: string
    maeManeeTerminalId: string
    merchantName?: string
    slipVerifier?: "SLIPOK" | "SLIP2GO"
  },
  env: "TEST" | "LIVE" = "TEST",
) {
  return prisma.billerProfile.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: {
      displayName, environment: env, status: "ACTIVE",
      credentialsEncrypted: {
        ...(opts.slipVerifier === "SLIPOK"  ? { slipokApiKey:    process.env.SLIPOK_API_KEY    ?? "mock-slipok-key"    } : {}),
        ...(opts.slipVerifier === "SLIP2GO" ? { slip2goApiSecret: process.env.SLIP2GO_API_SECRET ?? "mock-slip2go-secret" } : {}),
      },
      config: {
        mock: false,
        promptpayIdType: "maeMaNee",
        promptpayId: "",
        merchantName: (opts.merchantName ?? displayName).slice(0, 25),
        maeManeeBillerId:   opts.maeManeeBillerId,
        maeManeeRef1:       opts.maeManeeRef1,
        maeManeeTerminalId: opts.maeManeeTerminalId,
        ...(opts.slipVerifier ? { slipVerifier: opts.slipVerifier } : {}),
        ...(opts.slipVerifier === "SLIP2GO" ? {
          slip2goApiBaseUrl: process.env.SLIP2GO_API_BASE_URL ?? "https://connect.slip2go.com/api",
        } : {}),
        ...(opts.slipVerifier === "SLIPOK" ? {
          slipokApiBaseUrl:  process.env.SLIPOK_API_BASE_URL ?? "https://api.slipok.com/api/line/apikey",
          slipokBranchCode: "0",
        } : {}),
      },
    },
    create: {
      tenantId, code, displayName,
      providerCode: "THAI_QR",
      environment: env,
      billerId: null,
      merchantIdAtProvider: null,
      status: "ACTIVE",
      priority: 100,
      credentialsEncrypted: {
        ...(opts.slipVerifier === "SLIPOK"  ? { slipokApiKey:    process.env.SLIPOK_API_KEY    ?? "mock-slipok-key"    } : {}),
        ...(opts.slipVerifier === "SLIP2GO" ? { slip2goApiSecret: process.env.SLIP2GO_API_SECRET ?? "mock-slip2go-secret" } : {}),
      },
      config: {
        mock: false,
        promptpayIdType: "maeMaNee",
        promptpayId: "",
        merchantName: (opts.merchantName ?? displayName).slice(0, 25),
        maeManeeBillerId:   opts.maeManeeBillerId,
        maeManeeRef1:       opts.maeManeeRef1,
        maeManeeTerminalId: opts.maeManeeTerminalId,
        ...(opts.slipVerifier ? { slipVerifier: opts.slipVerifier } : {}),
        ...(opts.slipVerifier === "SLIP2GO" ? {
          slip2goApiBaseUrl: process.env.SLIP2GO_API_BASE_URL ?? "https://connect.slip2go.com/api",
        } : {}),
        ...(opts.slipVerifier === "SLIPOK" ? {
          slipokApiBaseUrl:  process.env.SLIPOK_API_BASE_URL ?? "https://api.slipok.com/api/line/apikey",
          slipokBranchCode: "0",
        } : {}),
      },
    },
  })
}

/**
 * Thai QR only biller — QR generation without a slip verifier.
 * Can be used when merchant handles verification themselves,
 * or for testing QR generation alone.
 */
async function upsertThaiQrBiller(tenantId: string, code: string, displayName: string, promptpayId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.billerProfile.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { displayName, environment: env, status: "ACTIVE" },
    create: {
      tenantId, code, displayName,
      providerCode: "THAI_QR",
      environment: env,
      billerId: null,
      merchantIdAtProvider: null,
      status: "ACTIVE",
      priority: 100,
      credentialsEncrypted: {},
      config: {
        mock: true,
        promptpayIdType: "mobile",
        promptpayId,
        merchantName: displayName.slice(0, 25),
        merchantCity: "Bangkok",
        // No slipVerifier — merchant uses their own verification
      },
    },
  })
}

async function upsertThaiQrRoute(tenantId: string, code: string, billerProfileId: string, methodType: "PROMPTPAY_QR" | "BANK_TRANSFER_SLIP" = "PROMPTPAY_QR", env: "TEST" | "LIVE" = "TEST") {
  return prisma.paymentRoute.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { billerProfileId, status: "ACTIVE", paymentMethodType: methodType },
    create: {
      tenantId, code,
      paymentMethodType: methodType,
      providerCode: "THAI_QR",
      environment: env,
      billerProfileId,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
  })
}

/**
 * Slip2Go verifier biller — providerCode = THAI_QR (QR generator)
 * slipVerifier = "SLIP2GO" stored in config, API secret in credentialsEncrypted
 * Each tenant registers their own Slip2Go account and stores the secret here.
 */
async function upsertSlip2GoBiller(tenantId: string, code: string, displayName: string, promptpayId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.billerProfile.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { displayName, environment: env, status: "ACTIVE" },
    create: {
      tenantId, code, displayName,
      providerCode: "THAI_QR",           // ← QR generator
      environment: env,
      billerId: null,
      merchantIdAtProvider: null,
      status: "ACTIVE",
      priority: 100,
      credentialsEncrypted: {
        slip2goApiSecret: process.env.SLIP2GO_API_SECRET ?? "mock-slip2go-secret",  // tenant's own secret
      },
      config: {
        mock: true,
        // Receiving account (QR points to this account)
        promptpayIdType: "mobile",
        promptpayId,
        merchantName: displayName.slice(0, 25),
        merchantCity: "Bangkok",
        // Slip verifier
        slipVerifier: "SLIP2GO",
        slip2goApiBaseUrl: process.env.SLIP2GO_API_BASE_URL ?? "https://connect.slip2go.com/api",
        slip2goReceiverAccountNumber: process.env.SLIP2GO_ACCOUNT ?? null,
      },
    },
  })
}

async function upsertSlip2GoRoute(tenantId: string, code: string, billerProfileId: string, env: "TEST" | "LIVE" = "TEST") {
  return prisma.paymentRoute.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { billerProfileId, status: "ACTIVE" },
    create: {
      tenantId, code,
      paymentMethodType: "BANK_TRANSFER_SLIP",
      providerCode: "THAI_QR",           // ← always THAI_QR
      environment: env,
      billerProfileId,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
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
  paymentMethodType?: string
  providerCode?: string
  slipVerifier?: "SLIPOK" | "SLIP2GO"
}) {
  const pid = publicId()
  const createdAt = params.createdAt ?? new Date()

  // ── Flow type detection ───────────────────────────────────────────────────
  const effectiveProvider = params.providerCode ?? "SCB"
  const isScbFlow    = effectiveProvider === "SCB"
  const isSlipFlow   = effectiveProvider === "THAI_QR" && params.paymentMethodType === "BANK_TRANSFER_SLIP"
  // else: THAI_QR + PROMPTPAY_QR (no slip verifier)
  const verifier     = params.slipVerifier ?? "SLIPOK"
  const SLIP_DELAY   = 30 * 60 * 1000  // customer takes ~30 min to pay + submit slip

  // กำหนด timestamps ตาม status
  const extra: Record<string, unknown> = {}
  if (params.status === "SUCCEEDED") {
    extra.succeededAt = new Date(createdAt.getTime() + (isSlipFlow ? SLIP_DELAY : 2 * 60 * 1000))
  } else if (params.status === "FAILED") {
    extra.failedAt = new Date(createdAt.getTime() + 5 * 60 * 1000)
    extra.failureReason = isSlipFlow ? "Slip verification failed" : "Payment declined by provider"
    extra.lastErrorCode = isSlipFlow ? "SLIP_REJECTED" : "PROVIDER_REJECTED"
    extra.lastErrorMessage = isSlipFlow ? "Slip rejected by verifier" : "Transaction declined"
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
      paymentMethodType: (params.paymentMethodType ?? "PROMPTPAY_QR") as any,
      providerCode: (params.providerCode ?? "SCB") as any,
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
      qrPayload: ["AWAITING_CUSTOMER","SUCCEEDED","FAILED","EXPIRED","CANCELLED","REVERSED","REFUNDED","PROCESSING"].includes(params.status)
        ? `00020101021230${nanoid(20)}`
        : null,
      createdAt,
      updatedAt: createdAt,
      ...extra,
    },
  })

  // ── สร้าง PaymentEvents ────────────────────────────────────────────────────
  const events: Array<{ type: string; fromStatus?: string; toStatus?: string; summary: string; createdAt: Date }> = [
    { type: "PAYMENT_CREATED", toStatus: "CREATED", summary: "Payment intent created", createdAt },
  ]

  if (!["CREATED"].includes(params.status)) {
    const routeSummary = isScbFlow
      ? "Route resolved: SCB PromptPay QR"
      : "Route resolved: THAI_QR (PayIQ native PromptPay)"
    events.push({ type: "ROUTE_RESOLVED", fromStatus: "CREATED", toStatus: "ROUTING", summary: routeSummary, createdAt: new Date(createdAt.getTime() + 500) })
  }
  if (!["CREATED", "ROUTING"].includes(params.status)) {
    const reqSummary = isScbFlow
      ? "QR creation requested to SCB API"
      : "QR generation started (local PromptPay engine)"
    events.push({ type: "PROVIDER_REQUESTED", fromStatus: "ROUTING", toStatus: "PENDING_PROVIDER", summary: reqSummary, createdAt: new Date(createdAt.getTime() + 1000) })
  }
  if (!["CREATED", "ROUTING", "PENDING_PROVIDER"].includes(params.status)) {
    const acceptSummary = isScbFlow
      ? "SCB created QR successfully, awaiting customer payment"
      : "PromptPay QR generated locally, awaiting customer payment"
    events.push({ type: "PROVIDER_ACCEPTED", fromStatus: "PENDING_PROVIDER", toStatus: "AWAITING_CUSTOMER", summary: acceptSummary, createdAt: new Date(createdAt.getTime() + 2000) })
  }

  // ── Terminal events (แยกตาม flow) ─────────────────────────────────────────
  if (params.status === "SUCCEEDED") {
    const succeededAt = extra.succeededAt as Date
    if (isScbFlow) {
      events.push(
        { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB", createdAt: new Date(createdAt.getTime() + 90000) },
        { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed successful", createdAt: succeededAt },
      )
    } else if (isSlipFlow) {
      const slipAt = new Date(succeededAt.getTime() - 30000)
      events.push(
        { type: "SLIP_SUBMITTED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Customer submitted bank transfer slip for verification", createdAt: slipAt },
        { type: "SLIP_VERIFIED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: `Slip verified via ${verifier}`, createdAt: new Date(slipAt.getTime() + 500) },
        { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed via slip verification", createdAt: succeededAt },
      )
    } else {
      events.push(
        { type: "PAYMENT_SUCCEEDED", fromStatus: "AWAITING_CUSTOMER", toStatus: "SUCCEEDED", summary: "Payment confirmed by merchant", createdAt: succeededAt },
      )
    }
    events.push(
      { type: "WEBHOOK_QUEUED", toStatus: "SUCCEEDED", summary: "Webhook queued for merchant notification", createdAt: new Date(succeededAt.getTime() + 100) },
      { type: "WEBHOOK_DELIVERED", toStatus: "SUCCEEDED", summary: "Webhook delivered to merchant endpoint", createdAt: new Date(succeededAt.getTime() + 500) },
    )
  } else if (params.status === "PROCESSING") {
    if (isScbFlow) {
      events.push({ type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB, processing", createdAt: new Date(createdAt.getTime() + 90000) })
    } else if (isSlipFlow) {
      events.push({ type: "SLIP_SUBMITTED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Customer submitted slip, verification in progress", createdAt: new Date(createdAt.getTime() + 90000) })
    }
  } else if (params.status === "FAILED") {
    const failedAt = extra.failedAt as Date
    if (isScbFlow) {
      events.push(
        { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB", createdAt: new Date(createdAt.getTime() + 60000) },
        { type: "PAYMENT_FAILED", fromStatus: "PROCESSING", toStatus: "FAILED", summary: "Payment failed: Transaction declined", createdAt: failedAt },
      )
    } else if (isSlipFlow) {
      const isDuplicate = params.description.toLowerCase().includes("duplicate") || params.description.includes("ซ้ำ")
      const isAmount   = params.description.toLowerCase().includes("amount") || params.description.includes("ยอด")
      const rejectMsg  = isDuplicate ? "Duplicate slip — this slip has already been used"
        : isAmount ? "Amount mismatch — slip amount does not match payment"
        : "Slip rejected by verifier"
      const slipAt = new Date(failedAt.getTime() - 30000)
      events.push(
        { type: "SLIP_SUBMITTED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Customer submitted bank transfer slip for verification", createdAt: slipAt },
        { type: "SLIP_REJECTED", fromStatus: "PROCESSING", toStatus: "FAILED", summary: rejectMsg, createdAt: new Date(slipAt.getTime() + 500) },
        { type: "PAYMENT_FAILED", fromStatus: "PROCESSING", toStatus: "FAILED", summary: rejectMsg, createdAt: failedAt },
      )
    } else {
      events.push({ type: "PAYMENT_FAILED", fromStatus: "AWAITING_CUSTOMER", toStatus: "FAILED", summary: "Payment failed", createdAt: failedAt })
    }
    events.push(
      { type: "WEBHOOK_QUEUED", toStatus: "FAILED", summary: "Webhook queued", createdAt: new Date(failedAt.getTime() + 100) },
      { type: "WEBHOOK_FAILED", toStatus: "FAILED", summary: "Webhook delivery failed: endpoint timeout", createdAt: new Date(failedAt.getTime() + 10500) },
    )
  } else if (params.status === "EXPIRED") {
    events.push({ type: "PAYMENT_EXPIRED", fromStatus: "AWAITING_CUSTOMER", toStatus: "EXPIRED", summary: "Payment QR expired after 15 minutes", createdAt: extra.expiredAt as Date })
  } else if (params.status === "CANCELLED") {
    events.push({ type: "PAYMENT_CANCELLED", fromStatus: "AWAITING_CUSTOMER", toStatus: "CANCELLED", summary: "Payment cancelled by merchant", createdAt: extra.cancelledAt as Date })
  } else if (params.status === "REVERSED") {
    const succeededAt = extra.succeededAt as Date
    if (isScbFlow) {
      events.push(
        { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB", createdAt: new Date(createdAt.getTime() + 90000) },
      )
    }
    events.push(
      { type: "PAYMENT_SUCCEEDED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", summary: "Payment confirmed successful", createdAt: succeededAt },
      { type: "WEBHOOK_QUEUED", toStatus: "SUCCEEDED", summary: "Webhook queued", createdAt: new Date(succeededAt.getTime() + 100) },
      { type: "WEBHOOK_DELIVERED", toStatus: "SUCCEEDED", summary: "Webhook delivered", createdAt: new Date(succeededAt.getTime() + 500) },
      { type: "PAYMENT_REVERSED", fromStatus: "SUCCEEDED", toStatus: "REVERSED", summary: "Payment reversed by merchant request", createdAt: new Date(succeededAt.getTime() + 60 * 60 * 1000) },
    )
  } else if (params.status === "REFUNDED") {
    const succeededAt = extra.succeededAt as Date
    if (isScbFlow) {
      events.push(
        { type: "PROVIDER_CALLBACK_RECEIVED", fromStatus: "AWAITING_CUSTOMER", toStatus: "PROCESSING", summary: "Payment callback received from SCB", createdAt: new Date(createdAt.getTime() + 90000) },
      )
    }
    events.push(
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

  // ── ProviderAttempts (แยกตาม flow) ────────────────────────────────────────
  if (!["CREATED", "ROUTING"].includes(params.status)) {
    const attemptAt = new Date(createdAt.getTime() + 1000)
    const isSuccess = !["FAILED"].includes(params.status)

    if (isScbFlow) {
      // ── SCB: CREATE_QR (outbound to SCB API) ──────────────────────────────
      await prisma.providerAttempt.create({
        data: {
          paymentIntentId: payment.id,
          type: "CREATE_QR" as any,
          status: "SUCCEEDED" as any,
          httpStatusCode: 200,
          requestId: nanoid(32),
          billerProfileId: params.billerProfileId,
          providerCode: "SCB" as any,
          providerEndpoint: "/payment/qrcode/create",
          httpMethod: "POST",
          providerTxnId: payment.providerTransactionId,
          sentAt: attemptAt,
          completedAt: new Date(attemptAt.getTime() + 350),
          requestHeaders: {
            "Content-Type": "application/json",
            "Authorization": "Bearer <scb-token>",
            "requestUId": nanoid(32),
            "resourceOwnerId": "scb-biller-mid",
          },
          requestBody: {
            qrType: "PP",
            ppType: "BILLERID",
            ppId: "010556833138901",
            amount: params.amount.toFixed(2),
            ref1: payment.merchantOrderId,
            ref2: payment.publicId,
            ref3: "SCB",
          },
          responseHeaders: { "Content-Type": "application/json", "X-Request-ID": nanoid(32) },
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

      // ── SCB: INQUIRY (outbound, triggered by callback) ────────────────────
      if (["SUCCEEDED", "FAILED", "PROCESSING", "REVERSED", "REFUNDED"].includes(params.status)) {
        const inquiryAt = new Date(createdAt.getTime() + 92000)
        await prisma.providerAttempt.create({
          data: {
            paymentIntentId: payment.id,
            type: "INQUIRY" as any,
            status: isSuccess ? "SUCCEEDED" as any : "FAILED" as any,
            httpStatusCode: 200,
            requestId: nanoid(32),
            billerProfileId: params.billerProfileId,
            providerCode: "SCB" as any,
            providerEndpoint: "/payment/billpayment/inquiry",
            httpMethod: "POST",
            providerTxnId: payment.providerTransactionId,
            sentAt: inquiryAt,
            completedAt: new Date(inquiryAt.getTime() + 280),
            requestHeaders: {
              "Content-Type": "application/json",
              "Authorization": "Bearer <scb-token>",
              "requestUId": nanoid(32),
            },
            requestBody: {
              transactionId: payment.providerTransactionId,
              sendingBank: "014",
            },
            responseHeaders: { "Content-Type": "application/json", "X-Correlation-ID": nanoid(24) },
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
                amount: params.amount.toFixed(2),
                paidLocalAmount: params.amount.toFixed(2),
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

      // ── SCB: ProviderCallback (inbound from SCB) ───────────────────────────
      if (["SUCCEEDED", "FAILED", "PROCESSING", "REVERSED", "REFUNDED"].includes(params.status)) {
        const cbAt = new Date(createdAt.getTime() + 90000)
        await prisma.providerCallback.create({
          data: {
            paymentIntentId: payment.id,
            billerProfileId: params.billerProfileId,
            providerCode: "SCB" as any,
            callbackType: "payment",
            processStatus: "PROCESSED" as any,
            providerReference: payment.providerReference,
            providerTxnId: payment.providerTransactionId,
            signatureValid: true,
            headers: { "Content-Type": "application/json", "X-SCB-Signature": `sha256=${nanoid(64)}` },
            body: {
              transactionId: payment.providerTransactionId,
              transRef: `REF${nanoid(10).toUpperCase()}`,
              sendingBank: "014",
              receivingBank: "014",
              transDate: createdAt.toISOString().split("T")[0].replace(/-/g, ""),
              transTime: createdAt.toTimeString().slice(0, 8).replace(/:/g, ""),
              sender: { name: params.customerName ?? "นาย ทดสอบ ระบบ", account: { value: "xxx-x-x1234-x" } },
              receiver: { name: "Acme Corp", account: { value: "010556833138901" } },
              amount: params.amount.toFixed(2),
              ref1: payment.merchantOrderId,
              ref2: payment.publicId,
              paymentStatus: isSuccess ? "SUCCESS" : "FAILED",
            },
            receivedAt: cbAt,
            processedAt: new Date(cbAt.getTime() + 150),
          },
        })
      }

    } else {
      // ── THAI_QR: CREATE_PAYMENT (local QR generation — no external API) ────
      const qrPayload = payment.qrPayload ?? `00020101021230${nanoid(20)}`
      await prisma.providerAttempt.create({
        data: {
          paymentIntentId: payment.id,
          type: "CREATE_PAYMENT" as any,
          status: "SUCCEEDED" as any,
          httpStatusCode: 200,
          requestId: nanoid(32),
          billerProfileId: params.billerProfileId,
          providerCode: "THAI_QR" as any,
          providerEndpoint: "generate-qr",
          httpMethod: "LOCAL",
          sentAt: attemptAt,
          completedAt: new Date(attemptAt.getTime() + 12),
          requestBody: {
            mode: "local_qr_generation",
            promptpayIdType: "mobile",
            promptpayId: isSlipFlow ? "089XXXXXXX" : "081XXXXXXX",
            amount: params.amount.toFixed(2),
            publicId: payment.publicId,
            merchantName: params.description.split(" ")[0],
          },
          responseBody: {
            qrPayload,
            method: "QR_DYNAMIC",
            application: "PROMPTPAY_CREDIT_TRANSFER",
            generatedAt: attemptAt.toISOString(),
          },
          createdAt: attemptAt,
          updatedAt: new Date(attemptAt.getTime() + 12),
        },
      })

      // ── THAI_QR Slip: VERIFY_SLIP (outbound to SlipOK / Slip2Go) ──────────
      if (isSlipFlow && ["SUCCEEDED", "FAILED"].includes(params.status)) {
        const slipAt = new Date(createdAt.getTime() + SLIP_DELAY - 30000)
        const isDuplicate = params.description.toLowerCase().includes("duplicate") || params.description.includes("ซ้ำ")
        const isAmount    = params.description.toLowerCase().includes("amount") || params.description.includes("ยอด")

        const slipokReqBody   = { data: qrPayload, amount: params.amount, log: true }
        const slip2goReqBody  = {
          payload: {
            qrCode: qrPayload,
            checkCondition: { checkDuplicate: true, checkAmount: { type: "eq", amount: params.amount } },
          },
        }

        const slipokSuccessBody = {
          success: true, code: 200,
          data: {
            transRef: `REF${nanoid(10).toUpperCase()}`,
            transDate: slipAt.toISOString().split("T")[0].replace(/-/g, ""),
            transTime: slipAt.toTimeString().slice(0, 8).replace(/:/g, ""),
            sender:   { name: params.customerName ?? "ผู้โอน", account: { bank: { code: "014", name: "SCB" }, value: "xxx-x1234-x" } },
            receiver: { name: "SlipPay Co., Ltd.",              account: { bank: { code: "014", name: "SCB" }, value: "xxx-x5678-x" } },
            amount: params.amount,
          },
        }
        const slip2goSuccessBody = {
          code: "200000", message: "success",
          data: {
            transRef: `SLIPGO${nanoid(10).toUpperCase()}`,
            transDate: slipAt.toISOString().split("T")[0].replace(/-/g, ""),
            transTime: slipAt.toTimeString().slice(0, 8).replace(/:/g, ""),
            sender:   { account: { name: params.customerName ?? "ผู้โอน",     bank: { code: "014", name: "SCB" } } },
            receiver: { account: { name: "VerifyPay Co., Ltd.", bank: { code: "014", name: "SCB" } } },
            amount: params.amount,
          },
        }

        const slipokFailBody  = isDuplicate
          ? { success: false, code: 1012, message: "Duplicate slip" }
          : isAmount ? { success: false, code: 1013, message: "Amount mismatch" }
          : { success: false, code: 1014, message: "Wrong receiver" }
        const slip2goFailBody = isDuplicate
          ? { code: "409001", message: "Duplicate transaction" }
          : isAmount ? { code: "422001", message: "Condition not met" }
          : { code: "404001", message: "Slip not found" }

        await prisma.providerAttempt.create({
          data: {
            paymentIntentId: payment.id,
            type: "VERIFY_SLIP" as any,
            status: isSuccess ? "SUCCEEDED" as any : "FAILED" as any,
            httpStatusCode: 200,
            requestId: nanoid(32),
            billerProfileId: params.billerProfileId,
            providerCode: verifier as any,
            providerEndpoint: verifier === "SLIPOK" ? "/api/line/apikey/{branch}" : "/verify-slip/qr-code/info",
            httpMethod: "POST",
            sentAt: slipAt,
            completedAt: new Date(slipAt.getTime() + 450),
            requestHeaders: verifier === "SLIPOK"
              ? { "Content-Type": "application/json", "x-authorization": "branch-0" }
              : { "Content-Type": "application/json", "Authorization": "Bearer <slip2go-secret>" },
            requestBody:  verifier === "SLIPOK" ? slipokReqBody  : slip2goReqBody,
            responseHeaders: { "Content-Type": "application/json" },
            responseBody: isSuccess
              ? (verifier === "SLIPOK" ? slipokSuccessBody : slip2goSuccessBody)
              : (verifier === "SLIPOK" ? slipokFailBody    : slip2goFailBody),
            errorCode:    isSuccess ? null : (verifier === "SLIPOK" ? String(slipokFailBody.code) : slip2goFailBody.code),
            errorMessage: isSuccess ? null : (verifier === "SLIPOK" ? slipokFailBody.message : slip2goFailBody.message),
            createdAt: slipAt,
            updatedAt: new Date(slipAt.getTime() + 450),
          },
        })
      }
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
  // TENANT 4: SlipPay — Bank Transfer Slip (SlipOK)
  // ══════════════════════════════════════════════════════════════
  console.log("\n🧾 Tenant: SlipPay")
  const slippay = await upsertTenant("slippay", "SlipPay Co., Ltd.")
  const slippayMerchant = await upsertMerchant(slippay.id, "slippay-main", "SlipPay Main Store")
  // promptpayId = SlipPay's own receiving account (phone number registered with PromptPay)
  const slippayBiller = await upsertSlipOkBiller(slippay.id, "slipok-test", "SlipOK Verify (TEST)", "0891234567")
  const slippayRoute = await upsertSlipOkRoute(slippay.id, "slip-test", slippayBiller.id)
  const slippayWebhook = await upsertWebhookEndpoint(slippay.id, slippayMerchant.id, "slippay-wh", "https://slippay.th/webhook/payiq")

  await upsertTenantUser(slippay.id, "admin@slippay.th", "Grace Kim", "OWNER")

  const slippayPayments = [
    { amount: 5000,  status: "SUCCEEDED",         desc: "Invoice #S001 - Wholesale Order", daysBack: 10, customer: "บริษัท ค้าส่ง จำกัด" },
    { amount: 1200,  status: "SUCCEEDED",         desc: "Invoice #S002 - Office Supplies",  daysBack: 8,  customer: "ห้างหุ้นส่วน ออฟฟิศ" },
    { amount: 8500,  status: "SUCCEEDED",         desc: "Invoice #S003 - Equipment",         daysBack: 7,  customer: "บริษัท อุปกรณ์ จำกัด" },
    { amount: 3300,  status: "FAILED",            desc: "Invoice #S004 - Wrong Amount",      daysBack: 6,  customer: "ลูกค้า ยอดผิด" },
    { amount: 2200,  status: "SUCCEEDED",         desc: "Invoice #S005 - Monthly Service",   daysBack: 5,  customer: "ร้านค้า บริการ" },
    { amount: 15000, status: "SUCCEEDED",         desc: "Invoice #S006 - Big Order",         daysBack: 3,  customer: "บริษัท ใหญ่ จำกัด" },
    { amount: 750,   status: "FAILED",            desc: "Invoice #S007 - Duplicate Slip",    daysBack: 2,  customer: "ลูกค้า สลิปซ้ำ" },
    { amount: 4400,  status: "AWAITING_CUSTOMER", desc: "Invoice #S008 - Pending Upload",    daysBack: 0,  customer: "ลูกค้า รอส่งสลิป" },
    { amount: 9800,  status: "AWAITING_CUSTOMER", desc: "Invoice #S009 - Large Transfer",    daysBack: 0,  customer: "บริษัท รอชำระ จำกัด" },
  ]

  for (const p of slippayPayments) {
    await createPayment({
      tenantId: slippay.id,
      merchantAccountId: slippayMerchant.id,
      billerProfileId: slippayBiller.id,
      routeId: slippayRoute.id,
      webhookEndpointId: slippayWebhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
      paymentMethodType: "BANK_TRANSFER_SLIP",
      providerCode: "THAI_QR",
      slipVerifier: "SLIPOK",
    })
  }
  console.log(`  ✅ ${slippayPayments.length} BANK_TRANSFER_SLIP payments created`)

  // ══════════════════════════════════════════════════════════════
  // TENANT 5: ThaiPay — THAI_QR (PayIQ native PromptPay QR)
  // ══════════════════════════════════════════════════════════════
  console.log("\n🇹🇭 Tenant: ThaiPay")
  const thaipay = await upsertTenant("thaipay", "ThaiPay Co., Ltd.")
  const thaipayMerchant = await upsertMerchant(thaipay.id, "thaipay-main", "ThaiPay Main")
  // promptpayId = ThaiPay's own receiving account
  const thaipayBiller = await upsertThaiQrBiller(thaipay.id, "thai-qr-test", "ThaiPay QR (TEST)", "0812345678")
  const thaipayRoute = await upsertThaiQrRoute(thaipay.id, "thai-qr-test", thaipayBiller.id, "PROMPTPAY_QR")
  const thaipayWebhook = await upsertWebhookEndpoint(thaipay.id, thaipayMerchant.id, "thaipay-wh", "https://thaipay.th/webhook/payiq")

  await upsertTenantUser(thaipay.id, "admin@thaipay.th", "Henry Park", "OWNER")

  const thaipayPayments = [
    { amount: 1000, status: "SUCCEEDED",         desc: "Order #T001 - Product A",   daysBack: 5, customer: "ลูกค้า 1" },
    { amount: 2500, status: "SUCCEEDED",         desc: "Order #T002 - Product B",   daysBack: 4, customer: "ลูกค้า 2" },
    { amount: 800,  status: "FAILED",            desc: "Order #T003 - Wrong Amount",daysBack: 3, customer: "ลูกค้า 3" },
    { amount: 3200, status: "SUCCEEDED",         desc: "Order #T004 - Product C",   daysBack: 2, customer: "ลูกค้า 4" },
    { amount: 600,  status: "AWAITING_CUSTOMER", desc: "Order #T005 - Pending",     daysBack: 0, customer: "ลูกค้า 5" },
    { amount: 1500, status: "AWAITING_CUSTOMER", desc: "Order #T006 - Pending",     daysBack: 0, customer: "ลูกค้า 6" },
  ]

  for (const p of thaipayPayments) {
    await createPayment({
      tenantId: thaipay.id,
      merchantAccountId: thaipayMerchant.id,
      billerProfileId: thaipayBiller.id,
      routeId: thaipayRoute.id,
      webhookEndpointId: thaipayWebhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
      paymentMethodType: "PROMPTPAY_QR",
      providerCode: "THAI_QR",
    })
  }
  console.log(`  ✅ ${thaipayPayments.length} THAI_QR/PROMPTPAY_QR payments created`)

  // ══════════════════════════════════════════════════════════════
  // TENANT 6: VerifyPay — SLIP2GO verifier
  // ══════════════════════════════════════════════════════════════
  console.log("\n✅ Tenant: VerifyPay")
  const verifypay = await upsertTenant("verifypay", "VerifyPay Co., Ltd.")
  const verifypayMerchant = await upsertMerchant(verifypay.id, "verifypay-main", "VerifyPay Store")
  // promptpayId = VerifyPay's own receiving account
  const verifypayBiller = await upsertSlip2GoBiller(verifypay.id, "slip2go-test", "Slip2Go Verify (TEST)", "0898765432")
  const verifypayRoute = await upsertSlip2GoRoute(verifypay.id, "slip2go-test", verifypayBiller.id)
  const verifypayWebhook = await upsertWebhookEndpoint(verifypay.id, verifypayMerchant.id, "verifypay-wh", "https://verifypay.th/webhook/payiq")

  await upsertTenantUser(verifypay.id, "admin@verifypay.th", "Iris Wong", "OWNER")

  const verifypayPayments = [
    { amount: 2000, status: "SUCCEEDED",         desc: "Invoice #V001 - Service A", daysBack: 6, customer: "ลูกค้า V1" },
    { amount: 5000, status: "SUCCEEDED",         desc: "Invoice #V002 - Service B", daysBack: 4, customer: "ลูกค้า V2" },
    { amount: 1500, status: "FAILED",            desc: "Invoice #V003 - Duplicate", daysBack: 3, customer: "ลูกค้า V3" },
    { amount: 7500, status: "SUCCEEDED",         desc: "Invoice #V004 - Service C", daysBack: 2, customer: "ลูกค้า V4" },
    { amount: 3000, status: "AWAITING_CUSTOMER", desc: "Invoice #V005 - Pending",   daysBack: 0, customer: "ลูกค้า V5" },
  ]

  for (const p of verifypayPayments) {
    await createPayment({
      tenantId: verifypay.id,
      merchantAccountId: verifypayMerchant.id,
      billerProfileId: verifypayBiller.id,
      routeId: verifypayRoute.id,
      webhookEndpointId: verifypayWebhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
      paymentMethodType: "BANK_TRANSFER_SLIP",
      providerCode: "THAI_QR",
      slipVerifier: "SLIP2GO",
    })
  }
  console.log(`  ✅ ${verifypayPayments.length} SLIP2GO/BANK_TRANSFER_SLIP payments created`)

  // ══════════════════════════════════════════════════════════════
  // TENANT 7: WashPoint — MaeMaNee QR (real billerID structure)
  // ══════════════════════════════════════════════════════════════
  console.log("\n🫧 Tenant: WashPoint")
  const washpoint = await upsertTenant("washpoint", "WashPoint Co., Ltd.")
  const washpointMerchant = await upsertMerchant(washpoint.id, "washpoint-main", "WashPoint Laundry")
  const washpointBiller = await upsertMaeManeeBiller(
    washpoint.id, "maemane-test", "MaeMaNee QR + Slip2Go (TEST)",
    {
      maeManeeBillerId:   "010753600010286",
      maeManeeRef1:       "014000003906609",
      maeManeeTerminalId: "0000000000591352",
      merchantName:       "WASHPOINT",
      slipVerifier:       "SLIP2GO",
    },
  )
  const washpointRoute = await upsertThaiQrRoute(washpoint.id, "maemane-test", washpointBiller.id, "BANK_TRANSFER_SLIP")
  const washpointWebhook = await upsertWebhookEndpoint(washpoint.id, washpointMerchant.id, "washpoint-wh", "https://washpoint.th/webhook/payiq")

  await upsertTenantUser(washpoint.id, "admin@washpoint.th", "Jack Wash", "OWNER")

  const washpointPayments = [
    { amount: 60,   status: "SUCCEEDED",         desc: "Wash #W001 - Normal Load",    daysBack: 5, customer: "นาย ทดสอบ หนึ่ง",   order: "ORD001W" },
    { amount: 80,   status: "SUCCEEDED",         desc: "Wash #W002 - Heavy Load",     daysBack: 4, customer: "นางสาว ทดสอบ สอง",  order: "ORD002W" },
    { amount: 60,   status: "FAILED",            desc: "Wash #W003 - Expired QR",     daysBack: 3, customer: "นาย ทดสอบ สาม",    order: "ORD003W" },
    { amount: 100,  status: "SUCCEEDED",         desc: "Wash #W004 - Dry Clean",      daysBack: 2, customer: "นางสาว ทดสอบ สี่",  order: "ORD004W" },
    { amount: 60,   status: "SUCCEEDED",         desc: "Wash #W005 - Normal Load",    daysBack: 1, customer: "นาย ทดสอบ ห้า",     order: "ORD005W" },
    { amount: 80,   status: "AWAITING_CUSTOMER", desc: "Wash #W006 - Pending Scan",   daysBack: 0, customer: "นาย ทดสอบ หก",     order: "ORD006W" },
    { amount: 60,   status: "AWAITING_CUSTOMER", desc: "Wash #W007 - Pending Scan",   daysBack: 0, customer: "นางสาว ทดสอบ เจ็ด", order: "ORD007W" },
  ]

  for (const p of washpointPayments) {
    await createPayment({
      tenantId: washpoint.id,
      merchantAccountId: washpointMerchant.id,
      billerProfileId: washpointBiller.id,
      routeId: washpointRoute.id,
      webhookEndpointId: washpointWebhook.id,
      amount: p.amount,
      description: p.desc,
      status: p.status,
      environment: "TEST",
      customerName: p.customer,
      createdAt: daysAgo(p.daysBack),
      merchantOrderId: p.order,
      paymentMethodType: "BANK_TRANSFER_SLIP",
      providerCode: "THAI_QR",
      slipVerifier: "SLIP2GO",
    })
  }
  console.log(`  ✅ ${washpointPayments.length} MaeMaNee+Slip2Go/BANK_TRANSFER_SLIP payments created`)

  // ══════════════════════════════════════════════════════════════
  // API Keys  — revoke all old keys first to avoid duplicates
  // ══════════════════════════════════════════════════════════════
  console.log("\n🔑 Creating API Keys...")

  await prisma.apiKey.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date() },
  })

  const keysToCreate = [
    { tenantCode: "acme",     merchantCode: "acme-store", name: "Acme Store TEST Key",    env: "TEST" as const },
    { tenantCode: "acme",     merchantCode: "acme-b2b",   name: "Acme B2B TEST Key",      env: "TEST" as const },
    { tenantCode: "techhub",  merchantCode: "techhub-saas", name: "TechHub TEST Key",     env: "TEST" as const },
    { tenantCode: "techhub",  merchantCode: "techhub-saas", name: "TechHub LIVE Key",     env: "LIVE" as const },
    { tenantCode: "quickpay", merchantCode: "qp-retail",  name: "QuickPay Retail Key",    env: "TEST" as const },
    { tenantCode: "quickpay", merchantCode: "qp-food",    name: "QuickPay Food & Bev Key", env: "TEST" as const },
    { tenantCode: "slippay",  merchantCode: "slippay-main",   name: "SlipPay TEST Key",       env: "TEST" as const },
    { tenantCode: "thaipay",  merchantCode: "thaipay-main",   name: "ThaiPay TEST Key",       env: "TEST" as const },
    { tenantCode: "verifypay",  merchantCode: "verifypay-main",  name: "VerifyPay TEST Key",   env: "TEST" as const },
    { tenantCode: "washpoint",  merchantCode: "washpoint-main",  name: "WashPoint TEST Key",   env: "TEST" as const },
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
  console.log("  • acme      — Acme Corp (E-Commerce)   — 2 merchants, 21 payments (PROMPTPAY_QR)")
  console.log("  • techhub   — TechHub Co. (SaaS)      — 1 merchant, TEST + LIVE billers, 14 payments")
  console.log("  • quickpay  — QuickPay Solutions       — 2 merchants, 12 payments (PROMPTPAY_QR)")
  console.log("  • slippay   — SlipPay Co., Ltd.        — 1 merchant, 9 payments  (BANK_TRANSFER_SLIP/SlipOK)")
  console.log("  • thaipay   — ThaiPay Co., Ltd.        — 1 merchant, 6 payments  (PROMPTPAY_QR/THAI_QR native)")
  console.log("  • verifypay — VerifyPay Co., Ltd.      — 1 merchant, 5 payments  (BANK_TRANSFER_SLIP/Slip2Go)")
  console.log("  • washpoint — WashPoint Co., Ltd.      — 1 merchant, 7 payments  (BANK_TRANSFER_SLIP/MaeMaNee+Slip2Go)")
  console.log("\nPortal login emails:")
  console.log("  • owner@acme.com     (OWNER)")
  console.log("  • dev@acme.com       (ADMIN)")
  console.log("  • finance@acme.com   (VIEWER)")
  console.log("  • ceo@techhub.co.th  (OWNER)")
  console.log("  • ops@techhub.co.th  (ADMIN)")
  console.log("  • admin@quickpay.th  (OWNER)")
  console.log("  • admin@slippay.th   (OWNER)")
  console.log("  • admin@thaipay.th   (OWNER)")
  console.log("  • admin@verifypay.th (OWNER)")
  console.log("  • admin@washpoint.th (OWNER)")
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
