import type {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProvider,
  ProviderBillerProfile,
  ProviderInquiryResult,
} from "../base/PaymentProvider";
import { getScbAccessToken } from "./scb.auth";
import {
  buildScbAuditRequest,
  buildScbAuditResponse,
  postScbJson,
} from "./scb.client";
import { getScbConfig, isScbMockMode } from "./scb.config";
import {
  buildScbCreateQrRequest,
  buildScbInquiryRequest,
  mapScbCreateResponse,
  mapScbInquiryResponse,
} from "./scb.mapper";
import type { ScbCreateQrResponse, ScbInquiryResponse } from "./scb.types";

function normalizeRef(value: string, maxLength = 20): string {
  return value
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, maxLength)
    .toUpperCase();
}

function buildMockQr(publicId: string, amount: string): string {
  const amountDigits = amount.replace(/[^\d]/g, "").slice(0, 10) || "0";
  return `00020101021129370016A0000006770101110113${publicId.slice(0, 13)}5303764540${amountDigits}5802TH6304ABCD`;
}

function buildRequestUId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

async function createScbPayment(
  input: CreateProviderPaymentInput,
): Promise<CreateProviderPaymentResult> {
  const config = getScbConfig(input.billerProfile);
  const accessToken = await getScbAccessToken(config);

  const requestBody = buildScbCreateQrRequest({
    input,
    billerId: config.billerId,
    callbackPrefix: config.callbackPrefix,
  });

  const requestHeaders = {
    resourceOwnerId: config.resourceOwnerId,
    requestUId: buildRequestUId(),
    "accept-language": config.acceptLanguage,
  };

  const url = `${config.apiBaseUrlV2}${config.createQrPath}`;

  const auditRequest = buildScbAuditRequest({
    url,
    headers: requestHeaders,
    body: requestBody,
  });

  try {
    const response = await postScbJson<ScbCreateQrResponse>({
      url,
      bearerToken: accessToken,
      headers: requestHeaders,
      body: requestBody,
      timeoutMs: config.timeoutMs,
    });

    return mapScbCreateResponse({
      request: requestBody,
      response: response.data,
      ok: response.ok,
      rawRequest: auditRequest,
      rawResponse: buildScbAuditResponse(response),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown SCB create payment error";

    return {
      success: false,
      providerReference: null,
      providerTransactionId: null,
      providerQrRef: null,
      qrPayload: null,
      deeplinkUrl: null,
      redirectUrl: null,
      rawRequest: auditRequest,
      rawResponse: {
        error: message,
      },
      errorCode: "FETCH_ERROR",
      errorMessage: message,
    };
  }
}

async function inquireScbPayment(args: {
  providerReference?: string | null;
  providerTransactionId?: string | null;
  billerProfile: ProviderBillerProfile;
}): Promise<ProviderInquiryResult> {
  const config = getScbConfig(args.billerProfile);
  const accessToken = await getScbAccessToken(config);

  if (!args.providerReference) {
    return {
      providerReference: null,
      providerTransactionId: args.providerTransactionId ?? null,
      providerQrRef: null,
      status: "FAILED",
      rawResponse: {
        error: "providerReference is required for SCB inquiry",
      },
    };
  }

  const requestQuery = buildScbInquiryRequest({
    billerId: config.billerId,
    providerReference: args.providerReference,
  });

  const url = new URL(`${config.apiBaseUrlV1}${config.inquiryPath}`);
  url.searchParams.set("eventCode", requestQuery.eventCode);
  url.searchParams.set("transactionDate", requestQuery.transactionDate);
  url.searchParams.set("billerId", requestQuery.billerId);
  url.searchParams.set("reference1", requestQuery.reference1);
  if (requestQuery.reference2) {
    url.searchParams.set("reference2", requestQuery.reference2);
  }
  if (requestQuery.amount) {
    url.searchParams.set("amount", requestQuery.amount);
  }

  const requestHeaders = {
    resourceOwnerId: config.resourceOwnerId,
    requestUId: buildRequestUId(),
    "accept-language": config.acceptLanguage,
    authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: requestHeaders,
  });

  const rawText = await response.text();
  const data = rawText ? (JSON.parse(rawText) as ScbInquiryResponse) : null;

  return mapScbInquiryResponse({
    request: requestQuery,
    response: data,
    rawResponse: {
      ok: response.ok,
      status: response.status,
      data,
      rawText,
    },
  });
}

export const scbProvider: PaymentProvider = {
  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<CreateProviderPaymentResult> {
    if (isScbMockMode(input.billerProfile)) {
      const config = getScbConfig(input.billerProfile);

      return {
        success: true,
        providerReference: normalizeRef(input.publicId),
        providerTransactionId: null,
        providerQrRef: normalizeRef(
          `${config.callbackPrefix}${input.publicId}`,
        ),
        qrPayload: buildMockQr(input.publicId, input.amount),
        deeplinkUrl: null,
        redirectUrl: null,
        rawRequest: {
          mode: "mock",
          publicId: input.publicId,
          amount: input.amount,
          merchantReference: input.merchantReference || null,
        },
        rawResponse: {
          success: true,
          mode: "mock",
        },
        errorCode: null,
        errorMessage: null,
      };
    }

    return createScbPayment(input);
  },

  async inquirePayment(input: {
    providerReference?: string | null;
    providerTransactionId?: string | null;
    billerProfile: ProviderBillerProfile;
  }): Promise<ProviderInquiryResult> {
    if (isScbMockMode(input.billerProfile)) {
      return {
        providerReference: input.providerReference
          ? normalizeRef(input.providerReference)
          : null,
        providerTransactionId: input.providerTransactionId || null,
        providerQrRef: "PYIQABC123",
        status: "SUCCEEDED",
        rawResponse: {
          mode: "mock",
          status: "SUCCESS",
        },
      };
    }

    const inquiryArgs: {
      providerReference?: string | null;
      providerTransactionId?: string | null;
      billerProfile: ProviderBillerProfile;
    } = {
      billerProfile: input.billerProfile,
    };

    if (input.providerReference !== undefined) {
      inquiryArgs.providerReference = input.providerReference;
    }

    if (input.providerTransactionId !== undefined) {
      inquiryArgs.providerTransactionId = input.providerTransactionId;
    }

    return inquireScbPayment(inquiryArgs);
  },
};
