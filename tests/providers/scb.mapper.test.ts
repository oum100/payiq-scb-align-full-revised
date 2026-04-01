import { describe, expect, test } from "bun:test"
import {
  buildScbCreateQrRequest,
  getScbResponseCode,
  mapScbCreateResponse,
  mapScbInquiryResponse,
  mapScbStatusToInternal,
} from "~/server/services/providers/scb/scb.mapper"

describe("scb.mapper", () => {
  test("maps statuses", () => {
    expect(mapScbStatusToInternal("SUCCESS")).toBe("SUCCEEDED")
    expect(mapScbStatusToInternal("AUTH")).toBe("SUCCEEDED")
    expect(mapScbStatusToInternal("PENDING")).toBe("PENDING")
    expect(mapScbStatusToInternal("EXPIRED")).toBe("EXPIRED")
    expect(mapScbStatusToInternal("UNKNOWN")).toBe("FAILED")
  })

  test("builds QR v2 request with SCB refs", () => {
    const request = buildScbCreateQrRequest({
      input: {
        paymentIntentId: "pi_123456",
        publicId: "piq_test_123456",
        amount: "20.00",
        currency: "THB",
        merchantOrderId: "ord_001",
        merchantReference: "sess_001",
        expiresAt: "2026-03-22T00:00:00.000Z",
        callbackUrl: "https://example.com/callback",
        billerProfile: {
          id: "bp_1",
          providerCode: "SCB",
          credentialsEncrypted: {},
          config: {},
        },
      },
      billerId: "123456789012345",
      callbackPrefix: "PYIQ",
    })

    expect(request.qrType).toBe("PP")
    expect(request.ppType).toBe("BILLERID")
    expect(request.ppId).toBe("123456789012345")
    expect(request.ref1).toBe("PIQTEST123456")
    expect(request.ref2).toBe("ORD001")
    expect(request.ref3?.startsWith("PYIQ")).toBe(true)
  })

  test("extracts response code", () => {
    expect(getScbResponseCode({ status: { code: 1000 } })).toBe("1000")
    expect(getScbResponseCode({ data: { code: "0000" } })).toBe("0000")
    expect(getScbResponseCode({ statusCode: "4001" })).toBe("4001")
  })

  test("maps create response", () => {
    const result = mapScbCreateResponse({
      request: {
        qrType: "PP",
        amount: 20,
        ppType: "BILLERID",
        ppId: "123456789012345",
        ref1: "PIQREF001",
        ref2: "ORDER001",
        ref3: "PYIQABC123",
      },
      response: {
        status: { code: 1000, description: "Success" },
        data: {
          code: "0000",
          message: "Success",
          success: true,
          data: {
            qrRawData: "QRDATA",
            url: "https://example.com/qr.png",
          },
        },
      },
      ok: true,
      rawRequest: { hello: "world" },
      rawResponse: { ok: true },
    })

    expect(result.success).toBe(true)
    expect(result.providerReference).toBe("PIQREF001")
    expect(result.providerTransactionId).toBeNull()
    expect(result.providerQrRef).toBe("PYIQABC123")
    expect(result.qrPayload).toBe("QRDATA")
    expect(result.redirectUrl).toBe("https://example.com/qr.png")
  })

  test("maps inquiry response", () => {
    const result = mapScbInquiryResponse({
      request: {
        eventCode: "00300100",
        transactionDate: "2026-03-22",
        billerId: "123456789012345",
        reference1: "PIQREF001",
      },
      response: {
        data: [
          {
            transactionId: "txn_2",
            transactionType: "Domestic Transfers",
            billPaymentRef1: "PIQREF001",
            billPaymentRef2: "ORDER001",
            billPaymentRef3: "PYIQABC123",
          },
        ],
      },
      rawResponse: { ok: true },
    })

    expect(result.providerTransactionId).toBe("txn_2")
    expect(result.providerReference).toBe("PIQREF001")
    expect(result.providerQrRef).toBe("PYIQABC123")
    expect(result.status).toBe("SUCCEEDED")
  })
})
