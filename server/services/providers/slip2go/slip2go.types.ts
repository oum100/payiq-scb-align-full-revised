// Slip2Go API types
// Base URL: connect.slip2go.com/api
// Auth: Authorization: Bearer {apiSecret}

// ─── Request ─────────────────────────────────────────────────────────────────

export type Slip2GoCheckCondition = {
  checkDuplicate?: boolean
  checkReceiver?: Array<{
    accountType?: string       // bank code e.g. "01004" = KBANK
    accountNameTH?: string     // partial match, no prefix
    accountNameEN?: string     // partial match, no prefix
    accountNumber?: string     // partial match (phone / citizenID / account no.)
  }>
  checkAmount?: {
    type?: "eq" | "gte" | "lte"  // default "eq"
    amount: number               // do NOT use 0 or commas
  }
  checkDate?: {
    type?: "eq" | "gte" | "lte"
    date: string                 // ISO 8601 GMT e.g. "2025-10-05T14:48:00.000Z"
  }
}

/** POST /verify-slip/qr-code/info */
export type Slip2GoQrRequest = {
  payload: {
    qrCode: string
    checkCondition?: Slip2GoCheckCondition
  }
}

/** POST /verify-slip/qr-image/info  (multipart/form-data)
 *  - field "file": image
 *  - field "payload": JSON string of Slip2GoCheckCondition (optional)
 */

// ─── Response ─────────────────────────────────────────────────────────────────

export type Slip2GoAccount = {
  name?: string   // partial
  bank?: { account?: string }
  proxy?: { type?: string; account?: string }
}

export type Slip2GoBankInfo = {
  id?: string     // e.g. "004"
  name?: string   // e.g. "ธนาคารกสิกรไทย"
}

export type Slip2GoParty = {
  account?: Slip2GoAccount
  bank?: Slip2GoBankInfo
}

export type Slip2GoData = {
  referenceId: string         // Slip2Go UUID
  decode: string              // raw QR string decoded from slip
  transRef: string            // bank transaction reference
  dateTime: string            // ISO 8601
  amount: number              // transfer amount
  ref1?: string | null
  ref2?: string | null
  ref3?: string | null
  receiver?: Slip2GoParty
  sender?: Slip2GoParty
}

export type Slip2GoSuccessResponse = {
  code: "200000"
  message: string
  data: Slip2GoData
}

export type Slip2GoErrorResponse = {
  code: string    // e.g. "400001" (bad request), "401001" (unauthorized), "404001" (slip not found), "409001" (duplicate)
  message: string
  data?: null
}

export type Slip2GoResponse = Slip2GoSuccessResponse | Slip2GoErrorResponse

// ─── Error code meanings ──────────────────────────────────────────────────────
// "200000" — success
// "400001" — bad request / invalid QR
// "401001" — unauthorized
// "404001" — slip not found / cannot verify
// "409001" — duplicate slip (checkDuplicate was true)
// "422001" — condition not met (amount/receiver mismatch)
// "503001" — bank service unavailable (retryable)
