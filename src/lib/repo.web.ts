import type {
  BackupData,
  DayData,
  DayEntry,
  Holder,
  HolderHistory,
  HolderInput,
  MonthlyReport,
  Profile,
} from './models'
import type {
  CollectionInput,
  HolderSort,
  HolderStatus,
  ListHoldersOptions,
  Repository,
} from './repo'
import { DEMO_COLLECTED_COUNT, DEMO_HOLDERS } from './demo'
import { todayIso } from './marathi'
import { buildMonthlyReport, commissionPeriod } from './reports'
import { compareAccountNo } from './sort'

const STORAGE_KEY = 'collection-summary.db.v1'

interface WebHolder {
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

interface WebCollection {
  id: number
  holderId: number
  date: string
  amount: number
  receiptNo: number
  createdAt: string
  updatedAt: string
}

interface WebState {
  profile: Profile | null
  setupComplete: boolean
  holders: WebHolder[]
  collections: WebCollection[]
  dailyMeta: Record<string, number>
  nextHolderId: number
  nextCollectionId: number
}

function emptyState(): WebState {
  return {
    profile: null,
    setupComplete: false,
    holders: [],
    collections: [],
    dailyMeta: {},
    nextHolderId: 1,
    nextCollectionId: 1,
  }
}

function readState(): WebState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<WebState>
    return {
      profile: parsed.profile ?? null,
      setupComplete: parsed.setupComplete === true,
      holders: Array.isArray(parsed.holders)
        ? parsed.holders.map((holder) => ({
            ...holder,
            nameEn: typeof holder.nameEn === 'string' ? holder.nameEn : '',
          }))
        : [],
      collections: Array.isArray(parsed.collections)
        ? parsed.collections
        : [],
      dailyMeta:
        parsed.dailyMeta && typeof parsed.dailyMeta === 'object'
          ? parsed.dailyMeta
          : {},
      nextHolderId:
        typeof parsed.nextHolderId === 'number' ? parsed.nextHolderId : 1,
      nextCollectionId:
        typeof parsed.nextCollectionId === 'number'
          ? parsed.nextCollectionId
          : 1,
    }
  } catch {
    return emptyState()
  }
}

function toHolder(holder: WebHolder): Holder {
  return { ...holder, nameEn: holder.nameEn ?? '' }
}

let instance: WebRepository | null = null

export class WebRepository implements Repository {
  private state: WebState = emptyState()

  static get(): WebRepository {
    if (!instance) instance = new WebRepository()
    return instance
  }

  async init(): Promise<void> {
    this.state = readState()
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      void 0
    }
  }

  async getProfile(): Promise<Profile | null> {
    return this.state.profile ? { ...this.state.profile } : null
  }

  async saveProfile(profile: Profile): Promise<void> {
    this.state.profile = { ...profile }
    this.persist()
  }

  async isSetupComplete(): Promise<boolean> {
    return this.state.setupComplete
  }

  async setSetupComplete(value: boolean): Promise<void> {
    this.state.setupComplete = value
    this.persist()
  }

  async listHolders(options: ListHoldersOptions = {}): Promise<Holder[]> {
    const status: HolderStatus = options.status ?? 'all'
    const sort: HolderSort = options.sort ?? 'account'
    const search = options.search?.trim().toLocaleLowerCase()

    const rows = this.state.holders
      .filter((holder) => {
        if (status === 'active' && !holder.active) return false
        if (status === 'inactive' && holder.active) return false
        if (search) {
          const haystack =
            `${holder.name} ${holder.nameEn} ${holder.accountNo}`.toLocaleLowerCase()
          if (!haystack.includes(search)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'name') {
          const byName = a.name.localeCompare(b.name)
          if (byName !== 0) return byName
        }
        return compareAccountNo(a.accountNo, b.accountNo)
      })

    return rows.map(toHolder)
  }

  async getHolder(id: number): Promise<Holder | null> {
    const holder = this.state.holders.find((row) => row.id === id)
    return holder ? toHolder(holder) : null
  }

  async createHolder(input: HolderInput): Promise<Holder> {
    const accountNo = input.accountNo.trim()
    if (this.state.holders.some((holder) => holder.accountNo === accountNo)) {
      throw new Error('UNIQUE constraint failed: holders.account_no')
    }
    const now = new Date().toISOString()
    const holder: WebHolder = {
      id: this.state.nextHolderId,
      name: input.name.trim().toUpperCase(),
      nameEn: (input.nameEn ?? '').trim().toUpperCase(),
      accountNo,
      defaultAmount: Math.max(0, Number(input.defaultAmount) || 0),
      phone: input.phone?.trim() || null,
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
    }
    this.state.nextHolderId += 1
    this.state.holders.push(holder)
    this.persist()
    return toHolder(holder)
  }

  async updateHolder(id: number, input: HolderInput): Promise<void> {
    const holder = this.state.holders.find((row) => row.id === id)
    if (!holder) throw new Error('Holder not found')
    const accountNo = input.accountNo.trim()
    if (
      this.state.holders.some(
        (row) => row.id !== id && row.accountNo === accountNo,
      )
    ) {
      throw new Error('UNIQUE constraint failed: holders.account_no')
    }
    holder.name = input.name.trim().toUpperCase()
    holder.nameEn = (input.nameEn ?? '').trim().toUpperCase()
    holder.accountNo = accountNo
    holder.defaultAmount = Math.max(0, Number(input.defaultAmount) || 0)
    holder.phone = input.phone?.trim() || null
    holder.active = input.active !== false
    holder.updatedAt = new Date().toISOString()
    this.persist()
  }

  async setHolderActive(id: number, active: boolean): Promise<void> {
    const holder = this.state.holders.find((row) => row.id === id)
    if (!holder) return
    holder.active = active
    holder.updatedAt = new Date().toISOString()
    this.persist()
  }

  async deleteHolder(id: number): Promise<void> {
    this.state.holders = this.state.holders.filter((row) => row.id !== id)
    this.state.collections = this.state.collections.filter(
      (row) => row.holderId !== id,
    )
    this.persist()
  }

  async nextAccountNo(): Promise<string> {
    let max = 0
    for (const holder of this.state.holders) {
      if (!/^\d+$/.test(holder.accountNo)) continue
      const value = Number(holder.accountNo)
      if (Number.isInteger(value) && value > max) max = value
    }
    return String(max + 1).padStart(3, '0')
  }

  async getDay(date: string): Promise<DayData> {
    const startReceipt = this.state.dailyMeta[date] ?? 1
    const entries = this.state.collections
      .filter((row) => row.date === date)
      .sort((a, b) => {
        if (a.receiptNo !== b.receiptNo) return a.receiptNo - b.receiptNo
        return a.id - b.id
      })
      .map((row): DayEntry | null => {
        const holder = this.state.holders.find(
          (candidate) => candidate.id === row.holderId,
        )
        if (!holder) return null
        return {
          collectionId: row.id,
          holderId: row.holderId,
          name: holder.name,
          nameEn: holder.nameEn ?? '',
          accountNo: holder.accountNo,
          amount: row.amount,
          receiptNo: row.receiptNo,
          defaultAmount: holder.defaultAmount,
          createdAt: row.createdAt,
        }
      })
      .filter((row): row is DayEntry => row !== null)

    return { date, startReceipt, entries }
  }

  async saveCollection(
    holderId: number,
    date: string,
    amount: number,
  ): Promise<void> {
    if (this.state.dailyMeta[date] === undefined) {
      this.state.dailyMeta[date] = 1
    }
    const now = new Date().toISOString()
    const existing = this.state.collections.find(
      (row) => row.holderId === holderId && row.date === date,
    )
    if (existing) {
      existing.amount = Math.max(0, Number(amount) || 0)
      existing.updatedAt = now
    } else {
      this.state.collections.push({
        id: this.state.nextCollectionId,
        holderId,
        date,
        amount: Math.max(0, Number(amount) || 0),
        receiptNo: 0,
        createdAt: now,
        updatedAt: now,
      })
      this.state.nextCollectionId += 1
    }
    this.renumber(date)
    this.persist()
  }

  async saveCollectionsWithReceipts(
    date: string,
    entries: CollectionInput[],
  ): Promise<void> {
    if (this.state.dailyMeta[date] === undefined) {
      this.state.dailyMeta[date] = 1
    }
    const used = new Set(
      this.state.collections
        .filter((row) => row.date === date)
        .map((row) => row.receiptNo),
    )
    const now = new Date().toISOString()
    for (const entry of entries) {
      const receiptNo = Math.floor(Number(entry.receiptNo) || 0)
      if (receiptNo <= 0) throw new Error('INVALID_RECEIPT')
      if (used.has(receiptNo)) throw new Error('DUPLICATE_RECEIPT')
      if (
        this.state.collections.some(
          (row) => row.holderId === entry.holderId && row.date === date,
        )
      ) {
        throw new Error('ALREADY_COLLECTED')
      }
      used.add(receiptNo)
      this.state.collections.push({
        id: this.state.nextCollectionId,
        holderId: entry.holderId,
        date,
        amount: Math.max(0, Number(entry.amount) || 0),
        receiptNo,
        createdAt: now,
        updatedAt: now,
      })
      this.state.nextCollectionId += 1
    }
    this.persist()
  }

  async deleteCollection(holderId: number, date: string): Promise<void> {
    this.state.collections = this.state.collections.filter(
      (row) => !(row.holderId === holderId && row.date === date),
    )
    this.renumber(date)
    this.persist()
  }

  async setStartReceipt(date: string, start: number): Promise<void> {
    this.state.dailyMeta[date] = Math.max(
      1,
      Math.floor(Number(start) || 1),
    )
    this.renumber(date)
    this.persist()
  }

  private renumber(date: string): void {
    const start = Math.max(1, this.state.dailyMeta[date] ?? 1)
    const rows = this.state.collections
      .filter((row) => row.date === date)
      .sort((a, b) => a.id - b.id)
    rows.forEach((row, index) => {
      row.receiptNo = start + index
    })
  }

  async getMonthlyReport(month: string): Promise<MonthlyReport> {
    const { start, end } = commissionPeriod(month)
    const rows = this.state.collections
      .filter((row) => row.date >= start && row.date <= end)
      .map((row) => {
        const holder = this.state.holders.find(
          (candidate) => candidate.id === row.holderId,
        )
        return {
          holderId: row.holderId,
          name: holder?.name ?? '',
          nameEn: holder?.nameEn ?? '',
          accountNo: holder?.accountNo ?? '',
          date: row.date,
          amount: row.amount,
        }
      })
    return buildMonthlyReport(month, rows)
  }

  async getHolderHistory(id: number): Promise<HolderHistory | null> {
    const holder = this.state.holders.find((row) => row.id === id)
    if (!holder) return null

    const entries = this.state.collections
      .filter((row) => row.holderId === id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((row) => ({
        date: row.date,
        amount: row.amount,
        receiptNo: row.receiptNo,
      }))
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
    const dates = entries.map((entry) => entry.date).sort()

    return {
      holder: toHolder(holder),
      entries,
      total,
      days: entries.length,
      firstDate: dates.length ? dates[0] : null,
      lastDate: dates.length ? dates[dates.length - 1] : null,
    }
  }

  async exportBackup(): Promise<BackupData> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.state.profile ? { ...this.state.profile } : null,
      setupComplete: this.state.setupComplete,
      holders: this.state.holders.map((holder) => ({ ...holder })),
      collections: this.state.collections.map((row) => ({
        holderId: row.holderId,
        date: row.date,
        amount: row.amount,
        receiptNo: row.receiptNo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      dailyMeta: { ...this.state.dailyMeta },
    }
  }

  async importBackup(data: BackupData): Promise<void> {
    const holders: WebHolder[] = data.holders.map((holder) => ({
      id: holder.id,
      name: holder.name,
      nameEn: holder.nameEn ?? '',
      accountNo: holder.accountNo,
      defaultAmount: Math.max(0, Number(holder.defaultAmount) || 0),
      phone: holder.phone ?? null,
      active: holder.active !== false,
      createdAt: holder.createdAt,
      updatedAt: holder.updatedAt,
    }))
    const collections: WebCollection[] = data.collections.map((row, index) => ({
      id: index + 1,
      holderId: row.holderId,
      date: row.date,
      amount: Math.max(0, Number(row.amount) || 0),
      receiptNo: Math.max(0, Number(row.receiptNo) || 0),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))

    this.state = {
      profile: data.profile ? { ...data.profile } : null,
      setupComplete: data.setupComplete === true,
      holders,
      collections,
      dailyMeta: { ...(data.dailyMeta ?? {}) },
      nextHolderId: holders.reduce((max, row) => Math.max(max, row.id), 0) + 1,
      nextCollectionId: collections.length + 1,
    }
    this.persist()
  }

  async seedDemoData(profile: Profile): Promise<void> {
    this.state.profile = { ...profile }
    this.state.setupComplete = true
    if (this.state.holders.length > 0) {
      this.persist()
      return
    }

    const now = new Date().toISOString()
    const date = todayIso()
    for (const demo of DEMO_HOLDERS) {
      this.state.holders.push({
        id: this.state.nextHolderId,
        name: demo.name,
        nameEn: '',
        accountNo: demo.accountNo,
        defaultAmount: demo.defaultAmount,
        phone: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      this.state.nextHolderId += 1
    }
    this.state.dailyMeta[date] = 1
    for (let i = 0; i < DEMO_COLLECTED_COUNT; i += 1) {
      const demo = DEMO_HOLDERS[i]
      const holder = this.state.holders.find(
        (row) => row.accountNo === demo.accountNo,
      )
      if (!holder) continue
      this.state.collections.push({
        id: this.state.nextCollectionId,
        holderId: holder.id,
        date,
        amount: demo.defaultAmount,
        receiptNo: 0,
        createdAt: now,
        updatedAt: now,
      })
      this.state.nextCollectionId += 1
    }
    this.renumber(date)
    this.persist()
  }
}
