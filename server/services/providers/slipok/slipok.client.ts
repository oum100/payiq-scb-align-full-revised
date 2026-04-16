import type { SlipOkConfig } from "./slipok.config"
import type { SlipOkResponse } from "./slipok.types"

/**
 * Verify a slip via QR string (text payload from PromptPay QR).
 */
export async function verifySlipByQr(
  config: SlipOkConfig,
  params: {
    qrData: string
    amount?: number
    log?: boolean
  },
): Promise<{ response: SlipOkResponse; httpStatus: number; rawRequest: unknown; rawResponse: unknown }> {
  const url = `${config.apiBaseUrl}/${config.branchCode ?? "0"}`

  const body: Record<string, unknown> = { data: params.qrData }
  if (params.amount !== undefined) body.amount = params.amount
  if (params.log !== undefined) body.log = params.log

  const rawRequest = { url, method: "POST", body }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let httpStatus = 0
  let rawResponse: unknown = null

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-authorization": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    httpStatus = res.status
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = { rawText: text } }
    rawResponse = { status: httpStatus, body: parsed }

    return {
      response: parsed as SlipOkResponse,
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SlipOK fetch error"
    rawResponse = { error: message }
    return {
      response: { success: false, code: 0, message },
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verify a slip via image file (multipart/form-data).
 */
export async function verifySlipByFile(
  config: SlipOkConfig,
  params: {
    imageData: Buffer | Uint8Array
    mimeType: string
    amount?: number
    log?: boolean
  },
): Promise<{ response: SlipOkResponse; httpStatus: number; rawRequest: unknown; rawResponse: unknown }> {
  const url = `${config.apiBaseUrl}/${config.branchCode ?? "0"}`

  const formData = new FormData()
  const blob = new Blob([params.imageData], { type: params.mimeType })
  formData.append("files", blob, "slip.jpg")
  if (params.amount !== undefined) formData.append("amount", String(params.amount))
  if (params.log !== undefined) formData.append("log", String(params.log))

  const rawRequest = { url, method: "POST", type: "multipart", amount: params.amount }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let httpStatus = 0
  let rawResponse: unknown = null

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-authorization": config.apiKey },
      body: formData,
      signal: controller.signal,
    })

    httpStatus = res.status
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = { rawText: text } }
    rawResponse = { status: httpStatus, body: parsed }

    return {
      response: parsed as SlipOkResponse,
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SlipOK fetch error"
    rawResponse = { error: message }
    return {
      response: { success: false, code: 0, message },
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } finally {
    clearTimeout(timer)
  }
}
