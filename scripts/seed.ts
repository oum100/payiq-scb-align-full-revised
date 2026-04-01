import { prisma } from "../server/lib/prisma";
import { createApiKey } from "../server/services/auth/createApiKey";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: "demo" },
    update: {
      name: "Demo Tenant",
      status: "ACTIVE",
      defaultCurrency: "THB",
    },
    create: {
      code: "demo",
      name: "Demo Tenant",
      status: "ACTIVE",
      defaultCurrency: "THB",
    },
  });

  const merchant = await prisma.merchantAccount.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "default",
      },
    },
    update: {
      name: "Default Merchant",
      status: "ACTIVE",
    },
    create: {
      tenantId: tenant.id,
      code: "default",
      name: "Default Merchant",
      status: "ACTIVE",
    },
  });

  const biller = await prisma.billerProfile.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "scb-main",
      },
    },
    update: {
      displayName: "SCB Main Biller",
      providerCode: "SCB",
      billerId: "123456789012345",
      environment: "TEST",
      credentialsEncrypted: {
        clientId: process.env.SCB_CLIENT_ID ?? "mock-key",
        clientSecret: process.env.SCB_CLIENT_SECRET ?? "mock-secret",
      },
      config: {
        env: "sandbox",
        mode: "mock",
        apiKey: process.env.SCB_CLIENT_ID ?? "mock-key",
        apiSecret: process.env.SCB_CLIENT_SECRET ?? "mock-secret",
        billerId: "123456789012345",
        tokenPath: "/oauth/token",
        inquiryPath: "/payment/billpayment/inquiry",
        apiBaseUrlV1:
          process.env.SCB_API_BASE_URL_V1 ??
          "https://api-sandbox.partners.scb/partners/sandbox/v1",
        apiBaseUrlV2:
          process.env.SCB_API_BASE_URL_V2 ??
          "https://api-sandbox.partners.scb/partners/sandbox/v2",
        createQrPath: "/payment/qrcode/create",
        callbackPrefix: "PYIQ",
        refreshTokenPath: "/oauth/token/refresh",
      },
    },
    create: {
      tenantId: tenant.id,
      code: "scb-main",
      displayName: "SCB Main Biller",
      providerCode: "SCB",
      billerId: "123456789012345",
      environment: "TEST",
      credentialsEncrypted: {
        clientId: process.env.SCB_CLIENT_ID ?? null,
        clientSecret: process.env.SCB_CLIENT_SECRET ?? null,
      },
      config: {
        env: "sandbox",
        apiBaseUrlV1:
          process.env.SCB_API_BASE_URL_V1 ??
          "https://api-sandbox.partners.scb/partners/sandbox/v1",
        apiBaseUrlV2:
          process.env.SCB_API_BASE_URL_V2 ??
          "https://api-sandbox.partners.scb/partners/sandbox/v2",
        apiKey: process.env.SCB_CLIENT_ID ?? null,
        apiSecret: process.env.SCB_CLIENT_SECRET ?? null,
        billerId: "123456789012345",
        callbackPrefix: "PYIQ",
        tokenPath: "/oauth/token",
        refreshTokenPath: "/oauth/token/refresh",
        createQrPath: "/payment/qrcode/create",
        inquiryPath: "/payment/billpayment/inquiry",
        mode: "mock",
      },
    },
  });

  await prisma.paymentRoute.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "promptpay-qr-default",
      },
    },
    update: {
      paymentMethodType: "PROMPTPAY_QR",
      providerCode: "SCB",
      billerProfileId: biller.id,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
    create: {
      tenantId: tenant.id,
      code: "promptpay-qr-default",
      paymentMethodType: "PROMPTPAY_QR",
      providerCode: "SCB",
      billerProfileId: biller.id,
      currency: "THB",
      isDefault: true,
      priority: 1,
      status: "ACTIVE",
    },
  });

  await prisma.webhookEndpoint.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "merchant-default",
      },
    },
    update: {
      url: "https://example.com/payiq/webhook",
      secretHash: null,
      secretEncrypted: "merchant-webhook-secret",
      subscribedEvents: ["PAYMENT_SUCCEEDED", "PAYMENT_FAILED"],
      status: "ACTIVE",
    },
    create: {
      tenantId: tenant.id,
      merchantAccountId: merchant.id,
      code: "merchant-default",
      url: "https://example.com/payiq/webhook",
      secretHash: null,
      secretEncrypted: "merchant-webhook-secret",
      subscribedEvents: ["PAYMENT_SUCCEEDED", "PAYMENT_FAILED"],
      status: "ACTIVE",
    },
  });

  const existingKeys = await prisma.apiKey.findMany({
    where: {
      tenantId: tenant.id,
      merchantAccountId: merchant.id,
    },
    take: 1,
  });

  if (existingKeys.length === 0) {
    const key = await createApiKey({
      tenantCode: tenant.code,
      merchantCode: merchant.code,
      name: "Default Merchant API Key",
      scopes: ["payments:create", "payments:read", "api_keys:manage"],
      environment: "TEST",
    });

    console.log("Seed completed");
    console.log(
      "IMPORTANT: save this API key now, it will not be shown again:",
    );
    console.log(key.fullKey);
  } else {
    console.log("Seed completed");
    console.log("API key already exists; create a new one via API if needed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
