import type {
  BackupData,
  CollectionExport,
  CollectionImportResult,
  DayData,
  Holder,
  HolderHistory,
  HolderInput,
  MonthlyReport,
  Profile,
} from './models'

export type HolderStatus = 'active' | 'inactive' | 'all'
export type HolderSort = 'account' | 'name'

export interface CollectionInput {
  holderId: number
  amount: number
  receiptNo: number
}

export interface ListHoldersOptions {
  search?: string
  status?: HolderStatus
  sort?: HolderSort
}

export interface Repository {
  init(): Promise<void>
  getProfile(): Promise<Profile | null>
  saveProfile(profile: Profile): Promise<void>
  isSetupComplete(): Promise<boolean>
  setSetupComplete(value: boolean): Promise<void>
  listHolders(options?: ListHoldersOptions): Promise<Holder[]>
  getHolder(id: number): Promise<Holder | null>
  createHolder(input: HolderInput): Promise<Holder>
  updateHolder(id: number, input: HolderInput): Promise<void>
  setHolderActive(id: number, active: boolean): Promise<void>
  deleteHolder(id: number): Promise<void>
  nextAccountNo(): Promise<string>
  getDay(date: string): Promise<DayData>
  setDayLocked(date: string, locked: boolean): Promise<void>
  saveCollection(holderId: number, date: string, amount: number): Promise<void>
  saveCollectionsWithReceipts(
    date: string,
    entries: CollectionInput[],
  ): Promise<void>
  deleteCollection(holderId: number, date: string): Promise<void>
  setStartReceipt(date: string, start: number): Promise<void>
  getMonthlyReport(month: string): Promise<MonthlyReport>
  getHolderHistory(id: number): Promise<HolderHistory | null>
  exportBackup(): Promise<BackupData>
  importBackup(data: BackupData): Promise<void>
  exportCollections(start: string, end: string): Promise<CollectionExport>
  importCollections(
    data: CollectionExport,
  ): Promise<CollectionImportResult>
  seedDemoData(profile: Profile): Promise<void>
}
