export interface Profile {
  societyName: string
  address: string
  agentName: string
  managerName: string
}

export interface Holder {
  id: number
  name: string
  nameEn: string
  accountNo: string
  defaultAmount: number
  phone: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface HolderInput {
  name: string
  nameEn?: string
  accountNo: string
  defaultAmount: number
  phone?: string | null
  active?: boolean
}

export interface DayEntry {
  collectionId: number
  holderId: number
  name: string
  nameEn: string
  accountNo: string
  amount: number
  receiptNo: number
  defaultAmount: number
  createdAt: string
}

export interface DayData {
  date: string
  startReceipt: number
  locked: boolean
  entries: DayEntry[]
}

export interface MonthlyHolderRow {
  holderId: number
  name: string
  nameEn: string
  accountNo: string
  days: number
  total: number
  commission: number
}

export interface MonthlyDayRow {
  date: string
  total: number
  count: number
}

export interface MonthlyReport {
  month: string
  periodStart: string
  periodEnd: string
  total: number
  commission: number
  days: number
  accounts: number
  holders: MonthlyHolderRow[]
  daily: MonthlyDayRow[]
}

export interface HolderHistoryEntry {
  date: string
  amount: number
  receiptNo: number
}

export interface HolderHistory {
  holder: Holder
  entries: HolderHistoryEntry[]
  total: number
  days: number
  firstDate: string | null
  lastDate: string | null
}

export interface BalanceReduction {
  id: number
  date: string
  amount: number
  createdAt: string
}

export type BalanceJournalType = 'opening' | 'reduction' | 'collection'

export interface BalanceJournalEntry {
  key: string
  type: BalanceJournalType
  date: string
  amount: number
  reference: string | null
  createdAt: string
}

export interface HolderBalance {
  openingAmount: number
  openingDate: string | null
  reductions: BalanceReduction[]
  journal: BalanceJournalEntry[]
  current: number
}

export interface BackupHolder {
  id: number
  name: string
  nameEn: string
  accountNo: string
  defaultAmount: number
  phone: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BackupCollection {
  holderId: number
  date: string
  amount: number
  receiptNo: number
  createdAt: string
  updatedAt: string
}

export interface BackupBalance {
  holderId: number
  openingAmount: number
  openingDate: string | null
}

export interface BackupBalanceReduction {
  holderId: number
  date: string
  amount: number
  createdAt: string
}

export interface BackupData {
  version: number
  exportedAt: string
  profile: Profile | null
  setupComplete: boolean
  holders: BackupHolder[]
  collections: BackupCollection[]
  dailyMeta: Record<string, number>
  locks: Record<string, boolean>
  balances: BackupBalance[]
  balanceReductions: BackupBalanceReduction[]
}

export interface CollectionExportRow {
  accountNo: string
  name: string
  date: string
  amount: number
  receiptNo: number
}

export interface CollectionExport {
  type: 'collection-export'
  version: number
  exportedAt: string
  range: { start: string; end: string }
  dailyMeta: Record<string, number>
  locks: Record<string, boolean>
  collections: CollectionExportRow[]
}

export interface CollectionImportResult {
  imported: number
  skipped: number
  dates: number
}
