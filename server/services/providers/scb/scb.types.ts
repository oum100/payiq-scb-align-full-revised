export type ScbProviderConfig = {
  env: "sandbox" | "production";
  apiBaseUrlV1: string;
  apiBaseUrlV2: string;
  apiKey: string;
  apiSecret: string;
  billerId: string;
  resourceOwnerId: string;
  callbackPrefix: string;
  callbackSecret?: string | null;
  tokenPath: string;
  refreshTokenPath: string;
  createQrPath: string;
  inquiryPath: string;
  tokenCacheTtlSec: number;
  timeoutMs: number;
  acceptLanguage: "EN" | "TH";
};

export type ScbTokenResponse = {
  status?: {
    code?: number | string;
    description?: string;
  };
  data?: {
    accessToken?: string;
    expiresIn?: number | string;
    expiresAt?: number | string;
    tokenType?: string;
    refreshToken?: string;
    refreshExpiresIn?: number | string;
    refreshExpiresAt?: number | string;
  };
  accessToken?: string;
  expiresIn?: number | string;
  tokenType?: string;
};

export type ScbCreateQrRequest = {
  qrType: "PP";
  amount?: number;
  ppType: "BILLERID";
  ppId: string;
  ref1: string;
  ref2?: string;
  ref3?: string;
  expiryDate?: string;
  numberOfTimes?: number;
};

export type ScbCreateQrResponse = {
  status?: {
    code?: number | string;
    description?: string;
  };
  data?: {
    code?: string;
    message?: string;
    moreInfo?: string;
    success?: boolean;
    data?: {
      qrRawData?: string;
      url?: string;
      expiryDate?: string;
      numberOfTimes?: number;
    };
    request?: {
      ref1?: string;
      ref2?: string;
      ref3?: string;
    };
  };
  qrRawData?: string;
  qrCode?: string;
  deeplinkUrl?: string;
  redirectUrl?: string;
  transactionId?: string;
  statusCode?: string | number;
  statusDesc?: string;
  paymentStatus?: string;
};

export type ScbInquiryRequest = {
  eventCode: "00300100";
  transactionDate: string;
  billerId: string;
  reference1: string;
  reference2?: string;
  amount?: string;
};

export type ScbInquiryItem = {
  eventCode?: string;
  transactionType?: string;
  amount?: string;
  transactionId?: string;
  transactionDateandTime?: string;
  billPaymentRef1?: string;
  billPaymentRef2?: string;
  billPaymentRef3?: string;
  currencyCode?: string;
  channelCode?: string;
  status?: string;
  paymentStatus?: string;
  statusText?: string;
};

export type ScbInquiryResponse = {
  status?: {
    code?: number | string;
    description?: string;
  };
  data?: ScbInquiryItem[];
};

export type ScbPaymentConfirmation = {
  transactionId?: string;
  amount?: string;
  transactionDateandTime?: string;
  currencyCode?: string;
  transactionType?: string;
  channelCode?: string;
  billPaymentRef1?: string;
  billPaymentRef2?: string;
  billPaymentRef3?: string;
  payerName?: string;
  payerAccountNumber?: string;
  payerProxyId?: string;
  payerProxyType?: string;
  payeeProxyId?: string;
  payeeProxyType?: string;
  payeeAccountNumber?: string;
  payeeName?: string;
  sendingBankCode?: string;
  receivingBankCode?: string;
  merchantId?: string;
  terminalId?: string;
  qrId?: string;
  consumerPAN?: string;
  traceNo?: string;
  authorizeCode?: string;
  paymentMethod?: string;
  exchangeRate?: string;
  equivalentAmount?: string;
  equivalentCurrencyCode?: string;
  companyId?: string;
};

export type ScbTransportResponse<T> = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  data: T | null;
  rawText: string;
};

export type ScbAuditPayload = {
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};
