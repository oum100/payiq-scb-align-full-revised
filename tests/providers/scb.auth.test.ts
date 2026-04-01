import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { clearScbTokenCache, getScbAccessToken } from "~/server/services/providers/scb/scb.auth"

const originalFetch = global.fetch

describe("scb.auth", () => {
  beforeEach(() => {
    clearScbTokenCache()
  })

  afterEach(() => {
    global.fetch = originalFetch
    mock.restore()
  })

  test("fetches and caches token", async () => {
    let callCount = 0

    global.fetch = mock(async () => {
      callCount += 1

      return new Response(
        JSON.stringify({
          status: { code: 1000, description: "Success" },
          data: {
            accessToken: "token_123",
            expiresIn: 900,
            tokenType: "Bearer",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      )
    }) as unknown as typeof fetch

    const config = {
      env: "sandbox" as const,
      apiBaseUrlV1: "https://api-sandbox.partners.scb/partners/sandbox/v1",
      apiBaseUrlV2: "https://api-sandbox.partners.scb/partners/sandbox/v2",
      apiKey: "key_1",
      apiSecret: "secret_1",
      billerId: "123456789012345",
      resourceOwnerId: "key_1",
      callbackPrefix: "PYIQ",
      callbackSecret: null,
      tokenPath: "/oauth/token",
      refreshTokenPath: "/oauth/token/refresh",
      createQrPath: "/payment/qrcode/create",
      inquiryPath: "/payment/billpayment/inquiry",
      tokenCacheTtlSec: 840,
      timeoutMs: 15000,
      acceptLanguage: "EN" as const,
    }

    const token1 = await getScbAccessToken(config)
    const token2 = await getScbAccessToken(config)

    expect(token1).toBe("token_123")
    expect(token2).toBe("token_123")
    expect(callCount).toBe(1)
  })

  test("throws when accessToken is missing", async () => {
    global.fetch = mock(async () => {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof fetch

    const config = {
      env: "sandbox" as const,
      apiBaseUrlV1: "https://api-sandbox.partners.scb/partners/sandbox/v1",
      apiBaseUrlV2: "https://api-sandbox.partners.scb/partners/sandbox/v2",
      apiKey: "key_1",
      apiSecret: "secret_1",
      billerId: "123456789012345",
      resourceOwnerId: "key_1",
      callbackPrefix: "PYIQ",
      callbackSecret: null,
      tokenPath: "/oauth/token",
      refreshTokenPath: "/oauth/token/refresh",
      createQrPath: "/payment/qrcode/create",
      inquiryPath: "/payment/billpayment/inquiry",
      tokenCacheTtlSec: 840,
      timeoutMs: 15000,
      acceptLanguage: "EN" as const,
    }

    await expect(getScbAccessToken(config)).rejects.toThrow(
      "SCB token response missing accessToken",
    )
  })
})
