import { randomUUID } from "node:crypto";
import { getScbConfig } from "./scb.config";
import type { ProviderBillerProfile } from "../base/PaymentProvider";
import type { ScbProviderConfig, ScbTokenResponse } from "./scb.types";

type CachedToken = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
};

const tokenCache = new Map<string, CachedToken>();

function getCacheKey(config: ScbProviderConfig): string {
  return `${config.env}:${config.apiKey}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function makeRequestUId(): string {
  return randomUUID().replace(/-/g, "");
}

function isValidToken(token?: CachedToken): token is CachedToken {
  return !!token && token.expiresAt - 60 > now();
}

function hasUsableRefreshToken(token?: CachedToken): boolean {
  return (
    !!token?.refreshToken &&
    !!token.refreshExpiresAt &&
    token.refreshExpiresAt - 60 > now()
  );
}

function toScbConfig(
  input: ProviderBillerProfile | ScbProviderConfig,
): ScbProviderConfig {
  if ("apiKey" in input && "apiSecret" in input && "apiBaseUrlV1" in input) {
    return input;
  }
  return getScbConfig(input);
}

function parseEpoch(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseToken(response: ScbTokenResponse): CachedToken {
  const payload = response.data;

  if (!payload?.accessToken) {
    throw new Error(
      `SCB token response missing accessToken: ${JSON.stringify(response)}`,
    );
  }

  const expiresAt =
    parseEpoch(payload.expiresAt) ??
    now() + (parseEpoch(payload.expiresIn) ?? 1800);

  const refreshToken =
    typeof payload.refreshToken === "string" && payload.refreshToken.length > 0
      ? payload.refreshToken
      : undefined;

  const refreshExpiresAt =
    parseEpoch(payload.refreshExpiresAt) ??
    (payload.refreshExpiresIn !== undefined
      ? now() + (parseEpoch(payload.refreshExpiresIn) ?? 0)
      : undefined);

  return {
    accessToken: payload.accessToken,
    expiresAt,
    ...(refreshToken ? { refreshToken } : {}),
    ...(refreshExpiresAt ? { refreshExpiresAt } : {}),
  };
}

async function requestToken(
  url: string,
  body: Record<string, unknown>,
  config: ScbProviderConfig,
): Promise<ScbTokenResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept-language": config.acceptLanguage,
        requestUId: makeRequestUId(),
        resourceOwnerId: config.resourceOwnerId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : {};

    if (!res.ok) {
      throw new Error(`SCB auth error ${res.status}: ${text}`);
    }

    return json as ScbTokenResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getScbAccessToken(
  input: ProviderBillerProfile | ScbProviderConfig,
): Promise<string> {
  const config = toScbConfig(input);
  const cacheKey = getCacheKey(config);
  const cached = tokenCache.get(cacheKey);

  if (isValidToken(cached)) {
    return cached.accessToken;
  }

  const refreshToken =
    hasUsableRefreshToken(cached) && cached ? cached.refreshToken : undefined;

  if (refreshToken) {
    try {
      return await refreshScbAccessToken(input, refreshToken);
    } catch {
      // fallback -> request new token
    }
  }

  const response = await requestToken(
    `${config.apiBaseUrlV1}${config.tokenPath}`,
    {
      applicationKey: config.apiKey,
      applicationSecret: config.apiSecret,
    },
    config,
  );

  const token = parseToken(response);
  tokenCache.set(cacheKey, token);

  return token.accessToken;
}

export async function refreshScbAccessToken(
  input: ProviderBillerProfile | ScbProviderConfig,
  refreshToken: string,
): Promise<string> {
  const config = toScbConfig(input);
  const cacheKey = getCacheKey(config);

  const response = await requestToken(
    `${config.apiBaseUrlV1}${config.refreshTokenPath}`,
    {
      applicationKey: config.apiKey,
      applicationSecret: config.apiSecret,
      refreshToken,
    },
    config,
  );

  const token = parseToken(response);
  tokenCache.set(cacheKey, token);

  return token.accessToken;
}

export function clearScbTokenCache(): void {
  tokenCache.clear();
}
