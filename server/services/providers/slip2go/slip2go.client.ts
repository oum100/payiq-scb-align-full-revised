import type { Slip2GoConfig } from "./slip2go.config"
import type { Slip2GoCheckCondition, Slip2GoResponse } from "./slip2go.types"

type VerifyResult = {
  response: Slip2GoResponse
  httpStatus: number
  rawRequest: unknown
  rawResponse: unknown
}

/** POST /verify-slip/qr-code/info */
export async function verifySlip2GoByQr(
  config: Slip2GoConfig,
  params: {
    qrCode: string
    condition?: Slip2GoCheckCondition
  },
): Promise<VerifyResult> {
  const url = `${config.apiBaseUrl}/verify-slip/qr-code/info`

  const body: Record<string, unknown> = {
    payload: {
      qrCode: params.qrCode,
      ...(params.condition ? { checkCondition: params.condition } : {}),
    },
  }

  const rawRequest = { url, method: "POST", body }
  return _post(config, url, body, rawRequest)
}

/** POST /verify-slip/qr-image/info  (multipart) */
export async function verifySlip2GoByFile(
  config: Slip2GoConfig,
  params: {
    imageData: Buffer | Uint8Array
    mimeType: string
    condition?: Slip2GoCheckCondition
  },
): Promise<VerifyResult> {
  const url = `${config.apiBaseUrl}/verify-slip/qr-image/info`

  const formData = new FormData()
  const blob = new Blob([params.imageData], { type: params.mimeType })
  formData.append("file", blob, "slip.jpg")

  if (params.condition) {
    formData.append("payload", JSON.stringify(params.condition))
  }

  const rawRequest = { url, method: "POST", type: "multipart", condition: params.condition }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let httpStatus = 0
  let rawResponse: unknown = null

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiSecret}` },
      body: formData,
      signal: controller.signal,
    })

    httpStatus = res.status
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { parsed = { rawText: text } }
    rawResponse = { status: httpStatus, body: parsed }

    return { response: parsed as Slip2GoResponse, httpStatus, rawRequest, rawResponse }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Slip2Go fetch error"
    rawResponse = { error: message }
    return {
      response: { code: "0", message },
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function _post(
  config: Slip2GoConfig,
  url: string,
  body: unknown,
  rawRequest: unknown,
): Promise<VerifyResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)

  let httpStatus = 0
  let rawResponse: unknown = null

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiSecret}`,
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

    return { response: parsed as Slip2GoResponse, httpStatus, rawRequest, rawResponse }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Slip2Go fetch error"
    rawResponse = { error: message }
    return {
      response: { code: "0", message },
      httpStatus,
      rawRequest,
      rawResponse,
    }
  } finally {
    clearTimeout(timer)
  }
}
