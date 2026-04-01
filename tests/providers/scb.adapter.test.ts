import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { clearScbTokenCache } from "~/server/services/providers/scb/scb.auth";
import { scbProvider } from "~/server/services/providers/scb/scb.adapter";

const originalFetch = global.fetch;

function makeInput() {
  return {
    paymentIntentId: "pi_1",
    publicId: "piq_1",
    amount: "20.00",
    currency: "THB",
    merchantOrderId: "ord_1",
    merchantReference: "sess_1",
    expiresAt: "2026-03-22T00:00:00.000Z",
    callbackUrl: "https://example.com/callback",
    billerProfile: {
      id: "bp_1",
      providerCode: "SCB",
      billerId: "123456789012345",
      merchantIdAtProvider: null,
      credentialsEncrypted: {},
      config: {
        env: "sandbox",
        apiBaseUrlV1: "https://api-sandbox.partners.scb/partners/sandbox/v1",
        apiBaseUrlV2: "https://api-sandbox.partners.scb/partners/sandbox/v2",
        apiKey: "key_1",
        apiSecret: "secret_1",
        billerId: "123456789012345",
        callbackPrefix: "PYIQ",
        tokenPath: "/oauth/token",
        refreshTokenPath: "/oauth/token/refresh",
        createQrPath: "/payment/qrcode/create",
        inquiryPath: "/payment/billpayment/inquiry",
        environment: "LIVE",
      },
    },
  };
}

describe("scb.adapter", () => {
  beforeEach(() => {
    clearScbTokenCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  test("returns mock result when config.mock=true", async () => {
    const base = makeInput();

    const result = await scbProvider.createPayment({
      ...base,
      billerProfile: {
        ...base.billerProfile,
        config: {
          mock: true,
          billerId: "123456789012345",
          callbackPrefix: "PYIQ",
          apiKey: "key_1",
          apiSecret: "secret_1",
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.providerReference).toBe("PIQ1");
    expect(result.providerQrRef?.startsWith("PYIQ")).toBe(true);
    expect(result.qrPayload).toContain("000201");
  });

  test("creates payment using SCB QR v2", async () => {
    global.fetch = mock(async (url: string | URL) => {
      if (String(url).includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            status: { code: 1000, description: "Success" },
            data: {
              accessToken: "token_abc",
              expiresIn: 900,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          status: { code: 1000, description: "Success" },
          data: {
            code: "0000",
            message: "Success",
            success: true,
            data: {
              qrRawData: "QR_123",
              url: "https://example.com/qr.png",
            },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as typeof fetch;

    const result = await scbProvider.createPayment(makeInput());

    expect(result.success).toBe(true);
    expect(result.providerReference).toBe("PIQ1");
    expect(result.providerTransactionId).toBeNull();
    expect(result.providerQrRef?.startsWith("PYIQ")).toBe(true);
    expect(result.qrPayload).toContain("000201");
    expect(result.redirectUrl).toBeNull();
  });

  test("inquiry maps bill payment callback refs", async () => {
    global.fetch = mock(async (url: string | URL) => {
      if (String(url).includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            status: { code: 1000, description: "Success" },
            data: {
              accessToken: "token_abc",
              expiresIn: 900,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          status: { code: 1000, description: "Success" },
          data: [
            {
              transactionId: "txn_456",
              transactionType: "Domestic Transfers",
              billPaymentRef1: "PIQ1",
              billPaymentRef2: "ORD1",
              billPaymentRef3: "PYIQABC123",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as unknown as typeof fetch;

    const input = makeInput();

    const result = await scbProvider.inquirePayment({
      providerReference: "PIQ1",
      providerTransactionId: "txn_456",
      billerProfile: input.billerProfile,
    });

    expect(result.providerTransactionId).toBe("txn_456");
    expect(result.providerReference).toBe("PIQ1");
    expect(result.providerQrRef).toBe("PYIQABC123");
    expect(result.status).toBe("SUCCEEDED");
  });
});
