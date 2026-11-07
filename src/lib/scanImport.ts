export interface ScanImportEntry {
  accountNo: string
  amount: string
}

export interface ScanImportResult {
  entries: ScanImportEntry[]
  skipped: number
}

const ACCOUNT_KEYS = [
  'accountNo',
  'account_no',
  'accountNumber',
  'account_number',
  'account',
  'acno',
  'ac_no',
  'no',
]

const AMOUNT_KEYS = ['amount', 'amt', 'value', 'rupees', 'rs', 'total']

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }
  if (typeof value === 'boolean') return ''
  return String(value).trim()
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  const lookup = new Map(
    Object.keys(record).map((key) => [key.toLowerCase(), key]),
  )
  for (const key of keys) {
    const match = lookup.get(key.toLowerCase())
    if (match) return record[match]
  }
  return undefined
}

function extractItem(item: unknown): ScanImportEntry | null {
  if (Array.isArray(item)) {
    if (item.length < 2) return null
    const accountNo = toText(item[0])
    const amount = toText(item[1])
    if (!accountNo && !amount) return null
    return { accountNo, amount }
  }
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    const accountNo = toText(pick(record, ACCOUNT_KEYS))
    const amount = toText(pick(record, AMOUNT_KEYS))
    if (!accountNo && !amount) return null
    return { accountNo, amount }
  }
  return null
}

export function parseScanImport(text: string): ScanImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('SCAN_IMPORT_INVALID')
  }

  let list: unknown
  if (Array.isArray(parsed)) {
    list = parsed
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const arrayKey = ['entries', 'rows', 'collections', 'data', 'holders'].find(
      (key) => Array.isArray(record[key]),
    )
    if (arrayKey) {
      list = record[arrayKey]
    } else {
      const entries = Object.entries(record)
      const primitives = entries.filter(
        ([, value]) => typeof value === 'number' || typeof value === 'string',
      )
      if (entries.length > 0 && primitives.length === entries.length) {
        return {
          entries: primitives.map(([accountNo, amount]) => ({
            accountNo,
            amount: toText(amount),
          })),
          skipped: 0,
        }
      }
      throw new Error('SCAN_IMPORT_INVALID')
    }
  } else {
    throw new Error('SCAN_IMPORT_INVALID')
  }

  if (!Array.isArray(list)) throw new Error('SCAN_IMPORT_INVALID')

  const entries: ScanImportEntry[] = []
  let skipped = 0
  for (const item of list) {
    const entry = extractItem(item)
    if (entry) entries.push(entry)
    else skipped += 1
  }
  if (entries.length === 0) throw new Error('SCAN_IMPORT_EMPTY')
  return { entries, skipped }
}