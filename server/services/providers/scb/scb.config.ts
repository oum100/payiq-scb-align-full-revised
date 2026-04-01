import type { ProviderBillerProfile } from "../base/PaymentProvider";
import type { ScbProviderConfig } from "./scb.types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";
}

function pickPreferredString(args: {
  config?: string;
  credentials?: string;
  profile?: string;
  env?: string;
}): string {
  if (isTestEnv()) {
    return args.config || args.credentials || args.profile || args.env || "";
  }

  return args.env || args.config || args.credentials || args.profile || "";
}

function pickPreferredOptionalString(args: {
  config?: string;
  credentials?: string;
  profile?: string;
  env?: string;
}): string | undefined {
  if (isTestEnv()) {
    return args.config || args.credentials || args.profile || args.env;
  }

  return args.env || args.config || args.credentials || args.profile;
}

function pickPreferredNumber(args: {
  config?: number;
  env?: number;
  fallback: number;
}): number {
  if (isTestEnv()) {
    return args.config ?? args.env ?? args.fallback;
  }

  return args.env ?? args.config ?? args.fallback;
}

export function isScbMockMode(billerProfile?: ProviderBillerProfile): boolean {
  const config = asRecord(billerProfile?.config);

  if (config.mock === true || config.mode === "mock") {
    return true;
  }

  if (config.mock === false || config.mode === "live") {
    return false;
  }

  return process.env.PAYIQ_PROVIDER_MODE === "mock";
}

export function getScbConfig(
  billerProfile: ProviderBillerProfile,
): ScbProviderConfig {
  const config = asRecord(billerProfile.config);
  const credentials = asRecord(billerProfile.credentialsEncrypted ?? {});

  const env = (() => {
    const configEnv = pickString(config, ["env", "environment"]);
    const profileEnv = typeof billerProfile.environment === "string" ? billerProfile.environment : undefined;
    const normalized = String(configEnv || profileEnv || "TEST").toUpperCase();
    return normalized === "LIVE" || normalized === "PRODUCTION" ? "production" : "sandbox";
  })();

  const apiBaseUrlV1 =
    pickString(config, ["apiBaseUrlV1"]) ||
    process.env.SCB_API_BASE_URL_V1 ||
    (env === "production"
      ? "https://api.partners.scb/partners/v1"
      : "https://api-sandbox.partners.scb/partners/sandbox/v1");

  const apiBaseUrlV2 =
    pickString(config, ["apiBaseUrlV2"]) ||
    process.env.SCB_API_BASE_URL_V2 ||
    (env === "production"
      ? "https://api.partners.scb/partners/v2"
      : "https://api-sandbox.partners.scb/partners/sandbox/v2");

  const apiKey =
    pickString(config, ["apiKey", "clientId", "client_id"]) ||
    pickString(credentials, ["apiKey", "clientId", "client_id"]) ||
    "";

  const apiSecret =
    pickString(config, ["apiSecret", "clientSecret", "client_secret"]) ||
    pickString(credentials, ["apiSecret", "clientSecret", "client_secret"]) ||
    "";

  const billerId =
    pickString(config, ["billerId", "biller_id"]) ||
    billerProfile.billerId ||
    "";

  const resourceOwnerId =
    pickString(config, ["resourceOwnerId"]) ||
    pickString(credentials, ["resourceOwnerId"]) ||
    pickString(asRecord(billerProfile), ["resourceOwnerId"]) ||
    apiKey;

  const callbackSecret =
    pickString(config, ["callbackSecret", "webhookSecret"]) ||
    pickString(credentials, ["callbackSecret", "webhookSecret"]) ||
    process.env.SCB_CALLBACK_SECRET ||
    null;

  const callbackPrefix =
    pickString(config, ["callbackPrefix", "ref3Prefix"]) ||
    process.env.SCB_CALLBACK_PREFIX ||
    "PYIQ";

  const tokenPath =
    pickPreferredString({
      config: pickString(config, ["tokenPath"]),
    }) || "/oauth/token";

  const refreshTokenPath =
    pickPreferredString({
      config: pickString(config, ["refreshTokenPath"]),
    }) || "/oauth/token/refresh";

  const createQrPath =
    pickPreferredString({
      config: pickString(config, ["createQrPath", "createPaymentPath"]),
    }) || "/payment/qrcode/create";

  const inquiryPath =
    pickPreferredString({
      config: pickString(config, ["inquiryPath", "paymentInquiryPath"]),
    }) || "/payment/billpayment/inquiry";

  const tokenCacheTtlSec =
    pickNumber(config, ["tokenCacheTtlSec"]) ||
    (process.env.SCB_TOKEN_CACHE_TTL_SEC
      ? Number(process.env.SCB_TOKEN_CACHE_TTL_SEC)
      : 840);

  const timeoutMs =
    pickNumber(config, ["timeoutMs"]) ||
    (process.env.SCB_TIMEOUT_MS ? Number(process.env.SCB_TIMEOUT_MS) : 15000);

  const acceptLanguage =
    (pickString(config, ["acceptLanguage"]) ||
      process.env.SCB_ACCEPT_LANGUAGE) === "TH"
      ? "TH"
      : "EN";

  const normalized: ScbProviderConfig = {
    env,
    apiBaseUrlV1: apiBaseUrlV1.replace(/\/+$/, ""),
    apiBaseUrlV2: apiBaseUrlV2.replace(/\/+$/, ""),
    apiKey,
    apiSecret,
    billerId,
    resourceOwnerId,
    callbackPrefix,
    callbackSecret,
    tokenPath,
    refreshTokenPath,
    createQrPath,
    inquiryPath,
    tokenCacheTtlSec,
    timeoutMs,
    acceptLanguage,
  };

  const missing: string[] = [];

  if (!normalized.apiKey) missing.push("apiKey");
  if (!normalized.apiSecret) missing.push("apiSecret");
  if (!normalized.billerId) missing.push("billerId");

  if (missing.length > 0) {
    throw new Error(
      `SCB biller profile ${billerProfile.id} is missing required config: ${missing.join(", ")}`,
    );
  }

  return normalized;
}
