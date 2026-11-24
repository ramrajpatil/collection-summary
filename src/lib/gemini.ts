import { Capacitor, CapacitorHttp } from '@capacitor/core'

const STORAGE_KEY = 'collection-summary.geminiKey'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Used only if the account's own model list can't be fetched. Otherwise we
// discover whatever generateContent models the key can use and try them,
// preferring the "free-tier friendly" flash ones.
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
]

let cachedModels: string[] | null = null

const PROMPT = `You are reading a handwritten daily collection sheet from a savings society in Maharashtra, India.
The sheet has two handwritten columns: an account number (usually 4-6 digits) and the collected amount (usually 1-5 digits) to its right.
Extract every account number and amount pair.

Return only JSON matching the requested schema.

Rules:
- accountNo: keep every digit exactly as written, including leading zeros.
- amount: whole rupees, digits only.
- Ignore names, dates, receipt numbers, totals, headers, signatures, and printed text.
- Include every handwritten account/amount row.
- If a digit is unclear, use the most likely reading.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    entries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          accountNo: { type: 'STRING' },
          amount: { type: 'NUMBER' },
        },
        required: ['accountNo', 'amount'],
      },
    },
  },
  required: ['entries'],
}

export interface GeminiEntry {
  accountNo: string
  amount: number
}

export function getGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setGeminiKey(value: string): void {
  try {
    const key = value.trim()
    if (key) localStorage.setItem(STORAGE_KEY, key)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    void 0
  }
}

export function parseGeminiEntries(text: string): GeminiEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return []
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return []
    }
  }

  const container = parsed as { entries?: unknown }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(container?.entries)
      ? container.entries
      : []

  const entries: GeminiEntry[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const rawAccount = record.accountNo ?? record.account ?? ''
    const rawAmount = record.amount ?? record.collectedAmount ?? ''
    const accountNo = String(rawAccount).replace(/\s+/g, '')
    const amountText = String(rawAmount).replace(/[^\d.-]/g, '')
    const amount = Number(amountText)
    if (!accountNo || !Number.isFinite(amount)) continue
    entries.push({ accountNo, amount })
  }
  return entries
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function prepareScannedImage(
  imageUriOrWebPath: string,
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageUriOrWebPath
  }

  const url = imageUriOrWebPath.startsWith('file://')
    ? Capacitor.convertFileSrc(imageUriOrWebPath)
    : imageUriOrWebPath

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('IMAGE_PREPARE_TIMEOUT'))
    }, 20000)

    const cleanup = () => clearTimeout(timer)

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      cleanup()
      try {
        const maxSide = 1600
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('CANVAS_CONTEXT_FAILED'))
          return
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        resolve(base64)
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    img.onerror = () => {
      cleanup()
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`FETCH_FAILED_${res.status}`)
          return res.blob()
        })
        .then((blob) => blobToBase64(blob))
        .then((base64) => resolve(base64))
        .catch((err) =>
          reject(
            new Error(
              `IMAGE_LOAD_FAILED: ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
        )
    }

    img.src = url
  })
}

function isModelUnavailable(status: number, detail: string): boolean {
  if (status === 404 || status === 429 || status === 503) return true
  return /not found|not available|not supported|unsupported|does not exist|deprecated|no longer/i.test(
    detail,
  )
}

function rankModel(name: string): number {
  const n = name.toLowerCase()
  let score = 0
  if (n.includes('flash')) score -= 10
  if (n.includes('pro')) score += 6
  if (n.includes('lite')) score += 3
  if (/preview|exp|experimental/.test(n)) score += 1
  return score
}

/**
 * Asks the API which models this key can actually use and returns them ordered
 * most-free-tier-friendly first (flash before pro, stable before preview).
 */
async function discoverModels(apiKey: string): Promise<string[]> {
  try {
    const res = await CapacitorHttp.get({
      url: `${API_BASE}/models?pageSize=200`,
      headers: { 'x-goog-api-key': apiKey },
    })
    if (res.status < 200 || res.status >= 300) return []
    const data =
      typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    const list = (data as { models?: unknown })?.models
    if (!Array.isArray(list)) return []
    return (
      list as Array<{ name?: string; supportedGenerationMethods?: string[] }>
    )
      .filter((model) =>
        (model.supportedGenerationMethods ?? []).includes('generateContent'),
      )
      .map((model) => (model.name ?? '').replace(/^models\//, ''))
      .filter(Boolean)
      .sort((a, b) => rankModel(a) - rankModel(b))
  } catch {
    return []
  }
}

function extractText(data: Record<string, unknown>): string {
  const candidates = data?.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined
  return (candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}

export async function recognizeWithGemini(
  imageBase64: string,
  apiKey: string,
): Promise<GeminiEntry[]> {
  const key = apiKey.trim()
  if (!key) throw new Error('MISSING_API_KEY')

  const models: string[] = []
  const discovered = cachedModels ?? (await discoverModels(key))
  if (discovered.length > 0) {
    cachedModels = discovered
    models.push(...discovered)
  }
  for (const name of MODEL_CANDIDATES) {
    if (!models.includes(name)) models.push(name)
  }

  let lastError: Error = new Error('EMPTY_RESPONSE')
  for (const model of models) {
    const response = await CapacitorHttp.post({
      url: `${API_BASE}/models/${model}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      data: {
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      },
    })

    if (response.status >= 200 && response.status < 300) {
      const data =
        typeof response.data === 'string'
          ? (JSON.parse(response.data) as Record<string, unknown>)
          : (response.data as Record<string, unknown>)
      const text = extractText(data)
      if (!text) {
        const feedback = data?.promptFeedback as
          | { blockReason?: string }
          | undefined
        lastError = new Error(feedback?.blockReason ?? 'EMPTY_RESPONSE')
        continue
      }
      // Remember the working model so later scans hit it first.
      cachedModels = [
        model,
        ...(cachedModels ?? []).filter((name) => name !== model),
      ]
      return parseGeminiEntries(text)
    }

    const detail =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data ?? '')
    const error = new Error(`HTTP_${response.status}: ${detail.slice(0, 240)}`)

    // Bad/absent key fails for every model — stop immediately.
    if (response.status === 401 || response.status === 403) throw error
    lastError = error
    // Model missing/overloaded/unsupported: try the next candidate.
    if (!isModelUnavailable(response.status, detail)) throw error
  }

  throw lastError
}