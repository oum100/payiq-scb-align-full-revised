// SlipOK API response types
// https://slipok.com/api-doc

export type SlipOkVerifyRequest = {
  data: string       // QR string from slip (for QR method)
  amount?: number    // expected amount for validation (triggers error 1013 if mismatch)
  log?: boolean      // true = dedup check (error 1012 if duplicate)
}

export type SlipOkVerifyFileRequest = {
  files: File | Blob  // image file of the slip
  amount?: number
  log?: boolean
}

export type SlipOkSender = {
  displayName: string
  name: string
  proxy?: {
    type: string    // e.g. "PromptPay"
    value: string   // e.g. "0812345678"
  } | null
  account?: {
    value: string   // masked account number
  } | null
}

export type SlipOkReceiver = {
  displayName: string
  name: string
  proxy?: {
    type: string
    value: string
  } | null
  account?: {
    value: string
  } | null
}

export type SlipOkData = {
  language: string
  transRef: string          // bank transaction reference
  date: string              // "YYYYMMDD"
  time: string              // "HH:MM:SS"
  symbol: string            // currency symbol e.g. "฿"
  amount: number            // transferred amount
  sender: SlipOkSender
  receiver: SlipOkReceiver
  bankCode?: string | null
}

export type SlipOkSuccessResponse = {
  success: true
  data: SlipOkData
}

export type SlipOkErrorResponse = {
  success: false
  code: number   // e.g. 1010 (bank delay), 1012 (duplicate), 1013 (wrong amount), 1014 (wrong receiver)
  message: string
}

export type SlipOkResponse = SlipOkSuccessResponse | SlipOkErrorResponse
