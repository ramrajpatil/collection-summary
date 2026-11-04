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

export interface BackupData {
  version: number
  exportedAt: string
  profile: Profile | null
  setupComplete: boolean
  holders: BackupHolder[]
  collections: BackupCollection[]
  dailyMeta: Record<string, number>
}
