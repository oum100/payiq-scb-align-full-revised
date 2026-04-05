import { describe, expect, test } from "bun:test";
import {
  getScbConfig,
  isScbMockMode,
} from "~~/server/services/providers/scb/scb.config";

describe("scb.config", () => {
  test("parses config from billerProfile.config", () => {
    const config = getScbConfig({
      id: "bp_1",
      providerCode: "SCB",
      billerId: null,
      merchantIdAtProvider: null,
      credentialsEncrypted: {},
      config: {
        env: "sandbox",
        apiBaseUrl: "https://api-sandbox.partners.scb/partners/sandbox/v1/",
        apiBaseUrlV2: "https://api-sandbox.partners.scb/partners/sandbox/v2/",
        apiKey: "key_123",
        apiSecret: "secret_123",
        billerId: "123456789012345",
        callbackPrefix: "PYIQ",
      },
    });

    expect(config.apiBaseUrlV1).toBe(
      "https://api-sandbox.partners.scb/partners/sandbox/v1",
    );
    expect(config.apiBaseUrlV2).toBe(
      "https://api-sandbox.partners.scb/partners/sandbox/v2",
    );
    expect(config.apiKey).toBe("key_123");
    expect(config.apiSecret).toBe("secret_123");
    expect(config.billerId).toBe("123456789012345");
    expect(config.callbackPrefix).toBe("PYIQ");
  });

  test("falls back to top-level fields", () => {
    const config = getScbConfig({
      id: "bp_2",
      providerCode: "SCB",
      billerId: "123456789012345",
      merchantIdAtProvider: null,
      credentialsEncrypted: {},
      config: {
        apiKey: "key_456",
        apiSecret: "secret_456",
        callbackPrefix: "SCB",
      },
    });

    expect(config.billerId).toBe("123456789012345");
    expect(config.resourceOwnerId).toBe("key_456");
    expect(config.callbackPrefix).toBe("SCB");
  });

  test("detects mock mode from config", () => {
    expect(
      isScbMockMode({
        id: "bp_3",
        providerCode: "SCB",
        billerId: null,
        merchantIdAtProvider: null,
        credentialsEncrypted: {},
        config: { mock: true },
      }),
    ).toBe(true);
  });

  test("throws when required config is missing", () => {
    expect(() =>
      getScbConfig({
        id: "bp_4",
        providerCode: "SCB",
        billerId: null,
        merchantIdAtProvider: null,
        credentialsEncrypted: {},
        config: {},
      }),
    ).toThrow("missing required config");
  });
});
