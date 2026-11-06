import { Capacitor } from '@capacitor/core'
import { FileSaver } from './filesaver'
import type {
  BackupCollection,
  BackupData,
  BackupHolder,
  Profile,
} from './models'

export const BACKUP_VERSION = 1

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

function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null
  return {
    societyName: asString(value.societyName),
    address: asString(value.address),
    agentName: asString(value.agentName),
    managerName: asString(value.managerName),
  }
}

function parseHolder(value: unknown): BackupHolder | null {
  if (!isRecord(value)) return null
  const id = asNumber(value.id)
  if (!id) return null
  const now = new Date().toISOString()
  return {
    id,
    name: asString(value.name),
    nameEn: asString(value.nameEn),
    accountNo: asString(value.accountNo),
    defaultAmount: asNumber(value.defaultAmount),
    phone: value.phone == null ? null : asString(value.phone),
    active: value.active !== false,
    createdAt: asString(value.createdAt, now),
    updatedAt: asString(value.updatedAt, now),
  }
}

function parseCollection(value: unknown): BackupCollection | null {
  if (!isRecord(value)) return null
  const holderId = asNumber(value.holderId)
  const date = asString(value.date)
  if (!holderId || !date) return null
  const now = new Date().toISOString()
  return {
    holderId,
    date,
    amount: asNumber(value.amount),
    receiptNo: asNumber(value.receiptNo),
    createdAt: asString(value.createdAt, now),
    updatedAt: asString(value.updatedAt, now),
  }
}

export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2)
}

export function parseBackup(text: string): BackupData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('INVALID_JSON')
  }
  if (!isRecord(raw)) throw new Error('INVALID_BACKUP')

  const rawHolders = Array.isArray(raw.holders) ? raw.holders : null
  const rawCollections = Array.isArray(raw.collections)
    ? raw.collections
    : null
  if (!rawHolders || !rawCollections) throw new Error('INVALID_BACKUP')

  const holders = rawHolders
    .map(parseHolder)
    .filter((row): row is BackupHolder => row !== null)
  const collections = rawCollections
    .map(parseCollection)
    .filter((row): row is BackupCollection => row !== null)

  if (holders.length === 0 && rawHolders.length > 0) {
    throw new Error('INVALID_BACKUP')
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

  return {
    version: asNumber(raw.version) || BACKUP_VERSION,
    exportedAt: asString(raw.exportedAt, new Date().toISOString()),
    profile: parseProfile(raw.profile),
    setupComplete: raw.setupComplete === true,
    holders,
    collections,
    dailyMeta,
    locks,
  }
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `collection-backup-${stamp}.json`
}

export interface BackupSaveResult {
  location: string
  uri: string | null
}

export async function saveBackupFile(
  fileName: string,
  text: string,
  mimeType = 'application/json',
): Promise<BackupSaveResult> {
  if (Capacitor.isNativePlatform()) {
    const result = await FileSaver.saveToDownloads({
      fileName,
      data: text,
      mimeType,
      share: true,
    })
    return { location: result.location, uri: result.uri }
  }

  const blob = new Blob([text], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { location: fileName, uri: null }
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'))
    reader.readAsText(file)
  })
}
