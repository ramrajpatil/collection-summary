import type {
  BackupData,
  DayData,
  Holder,
  HolderHistory,
  HolderInput,
  MonthlyReport,
  Profile,
} from './models'

export type HolderStatus = 'active' | 'inactive' | 'all'
export type HolderSort = 'account' | 'name'

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
  saveCollection(holderId: number, date: string, amount: number): Promise<void>
  deleteCollection(holderId: number, date: string): Promise<void>
  setStartReceipt(date: string, start: number): Promise<void>
  getMonthlyReport(month: string): Promise<MonthlyReport>
  getHolderHistory(id: number): Promise<HolderHistory | null>
  exportBackup(): Promise<BackupData>
  importBackup(data: BackupData): Promise<void>
  seedDemoData(profile: Profile): Promise<void>
}
