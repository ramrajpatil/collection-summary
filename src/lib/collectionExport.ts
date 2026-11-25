import type {
  CollectionExport,
  CollectionExportRow,
} from './models'
import { saveBackupFile } from './backup'

export const COLLECTION_EXPORT_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function parseRow(value: unknown): CollectionExportRow | null {
  if (!isRecord(value)) return null
  const date = asString(value.date)
  const accountNo = asString(value.accountNo)
  if (!date || !accountNo) return null
  return {
    accountNo,
    name: asString(value.name),
    date,
    amount: asNumber(value.amount),
    receiptNo: asNumber(value.receiptNo),
  }
}

export function serializeCollectionExport(data: CollectionExport): string {
  return JSON.stringify(data, null, 2)
}

export function parseCollectionExport(text: string): CollectionExport {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('INVALID_JSON')
  }
  if (!isRecord(raw)) throw new Error('INVALID_EXPORT')

  const rawCollections = raw.collections
  if (!Array.isArray(rawCollections)) throw new Error('INVALID_EXPORT')

  const collections = rawCollections
    .map(parseRow)
    .filter((row): row is CollectionExportRow => row !== null)
  if (collections.length === 0 && rawCollections.length > 0) {
    throw new Error('INVALID_EXPORT')
  }

  const dailyMeta: Record<string, number> = {}
  if (isRecord(raw.dailyMeta)) {
    for (const [date, start] of Object.entries(raw.dailyMeta)) {
      dailyMeta[date] = asNumber(start)
    }
  }

  const locks: Record<string, boolean> = {}
  if (isRecord(raw.locks)) {
    for (const [date, locked] of Object.entries(raw.locks)) {
      if (locked === true) locks[date] = true
    }
  }

  const range = isRecord(raw.range)
    ? {
        start: asString(raw.range.start),
        end: asString(raw.range.end),
      }
    : { start: '', end: '' }

  return {
    type: 'collection-export',
    version: asNumber(raw.version) || COLLECTION_EXPORT_VERSION,
    exportedAt: asString(raw.exportedAt, new Date().toISOString()),
    range,
    dailyMeta,
    locks,
    collections,
  }
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function collectionExportCsv(
  data: CollectionExport,
  receiptsEnabled = true,
): string {
  const header = receiptsEnabled
    ? 'Date,Account No,Name,Receipt No,Amount,Locked'
    : 'Date,Account No,Name,Amount,Locked'
  const lines = [header]
  for (const row of data.collections) {
    const cells = receiptsEnabled
      ? [
          row.date,
          row.accountNo,
          row.name,
          String(row.receiptNo),
          String(row.amount),
          data.locks[row.date] ? 'YES' : 'NO',
        ]
      : [
          row.date,
          row.accountNo,
          row.name,
          String(row.amount),
          data.locks[row.date] ? 'YES' : 'NO',
        ]
    lines.push(cells.map(csvCell).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

export function collectionExportFileName(
  data: CollectionExport,
  extension: 'json' | 'csv',
): string {
  const { start, end } = data.range
  const stamp =
    start && end
      ? start === end
        ? start
        : `${start}_to_${end}`
      : new Date().toISOString().slice(0, 10)
  return `collection-${stamp}.${extension}`
}

export async function saveCollectionExportFile(
  fileName: string,
  text: string,
  mimeType: string,
): Promise<string> {
  const result = await saveBackupFile(fileName, text, mimeType)
  return result.location
}

export interface CollectionExportSummary {
  start: string
  end: string
  rows: number
  days: number
  total: number
}

export function summarizeCollectionExport(
  data: CollectionExport,
): CollectionExportSummary {
  const dates = new Set<string>()
  let total = 0
  for (const row of data.collections) {
    dates.add(row.date)
    total += row.amount
  }
  const sorted = [...dates].sort()
  return {
    start: data.range.start || sorted[0] || '',
    end: data.range.end || sorted[sorted.length - 1] || '',
    rows: data.collections.length,
    days: dates.size,
    total,
  }
}

export interface CollectionDaySummary {
  date: string
  accounts: number
  total: number
}

export interface CollectionMonthDaysSummary {
  month: string
  dayCount: number
  accounts: number
  total: number
  days: CollectionDaySummary[]
}

export function collectionMonthDaySummaries(
  data: CollectionExport,
): CollectionMonthDaysSummary[] {
  const months = new Map<
    string,
    { days: Map<string, CollectionDaySummary>; accounts: number; total: number }
  >()

  for (const row of data.collections) {
    const month = row.date.slice(0, 7)
    if (!month) continue
    let bucket = months.get(month)
    if (!bucket) {
      bucket = { days: new Map(), accounts: 0, total: 0 }
      months.set(month, bucket)
    }
    bucket.accounts += 1
    bucket.total += row.amount
    const day = bucket.days.get(row.date) ?? {
      date: row.date,
      accounts: 0,
      total: 0,
    }
    day.accounts += 1
    day.total += row.amount
    bucket.days.set(row.date, day)
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      dayCount: bucket.days.size,
      accounts: bucket.accounts,
      total: bucket.total,
      days: [...bucket.days.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    }))
}
