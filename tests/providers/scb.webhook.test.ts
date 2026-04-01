import { describe, expect, test } from "bun:test"
import {
  extractScbSignatureHeader,
  normalizeScbCallback,
} from "~/server/services/providers/scb/scb.webhook"

describe("scb.webhook", () => {
  test("extracts signature header from x-signature", () => {
    const signature = extractScbSignatureHeader({
      "x-signature": "sig_123",
    })

    expect(signature).toBe("sig_123")
  })

  test("extracts signature header from authorization fallback", () => {
    const signature = extractScbSignatureHeader({
      authorization: "Bearer abc",
    })

    expect(signature).toBe("Bearer abc")
  })

  test("normalizes SCB payment confirmation payload as succeeded", () => {
    const normalized = normalizeScbCallback({
      rawBody: JSON.stringify({
        billPaymentRef1: "PIQREF001",
        billPaymentRef2: "ORDER001",
        billPaymentRef3: "PYIQABC123",
        transactionId: "txn_001",
        transactionType: "Domestic Transfers",
        amount: "20.00",
        transactionDateandTime: "2026-03-22T10:00:00+07:00",
        currencyCode: "764",
      }),
      headers: {
        "x-signature": "sig_001",
      },
    })

    expect(normalized.providerReference).toBe("PIQREF001")
    expect(normalized.providerTxnId).toBe("txn_001")
    expect(normalized.providerQrRef).toBe("PYIQABC123")
    expect(normalized.externalStatus).toBe("Domestic Transfers")
    expect(normalized.normalizedStatus).toBe("SUCCEEDED")
    expect(normalized.eventId).toBe("txn_001")
    expect(normalized.signatureHeader).toBe("sig_001")

    const enriched = normalized.enrichedBody as Record<string, unknown>
    expect(enriched._normalized).toBeDefined()
  })

  test("falls back to succeeded when status field is absent but payment confirmation fields exist", () => {
    const normalized = normalizeScbCallback({
      rawBody: JSON.stringify({
        billPaymentRef1: "PIQREF002",
        transactionId: "txn_002",
        amount: "10.00",
        transactionDateandTime: "2026-03-22T10:00:00+07:00",
      }),
      headers: {},
    })

    expect(normalized.providerReference).toBe("PIQREF002")
    expect(normalized.normalizedStatus).toBe("SUCCEEDED")
  })

  test("handles invalid json safely", () => {
    const normalized = normalizeScbCallback({
      rawBody: "{invalid-json",
      headers: {},
    })

    expect(normalized.providerReference).toBeNull()
    expect(normalized.providerTxnId).toBeNull()
    expect(normalized.externalStatus).toBeNull()
    expect(normalized.normalizedStatus).toBeNull()

    const enriched = normalized.enrichedBody as Record<string, unknown>
    expect(enriched._normalized).toBeDefined()
  })
})
