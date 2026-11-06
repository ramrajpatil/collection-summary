import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import type {
  BackupData,
  CollectionExport,
  CollectionImportResult,
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

const DB_NAME = 'collection_summary'
const DB_VERSION = 1

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS holders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  account_no TEXT NOT NULL UNIQUE,
  default_amount REAL NOT NULL DEFAULT 0,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  holder_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  receipt_no INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(holder_id, date),
  FOREIGN KEY(holder_id) REFERENCES holders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_collections_date ON collections(date);
CREATE INDEX IF NOT EXISTS idx_collections_date_id ON collections(date, id);
CREATE TABLE IF NOT EXISTS daily_meta (
  date TEXT PRIMARY KEY NOT NULL,
  start_receipt INTEGER NOT NULL DEFAULT 1,
  locked INTEGER NOT NULL DEFAULT 0
);
`

interface HolderRow {
  id: number
  name: string
  name_en: string | null
  account_no: string
  default_amount: number
  phone: string | null
  active: number
  created_at: string
  updated_at: string
}

interface DayRow {
  collection_id: number
  holder_id: number
  amount: number
  receipt_no: number
  created_at: string
  name: string
  name_en: string | null
  account_no: string
  default_amount: number
}

interface ReportRow {
  holder_id: number
  date: string
  amount: number
  name: string
  name_en: string | null
  account_no: string
}

interface TableColumnRow {
  name: string
}

interface ExportCollectionRow {
  id: number
  holder_id: number
  date: string
  amount: number
  receipt_no: number
  created_at: string
  updated_at: string
}

interface HistoryRow {
  date: string
  amount: number
  receipt_no: number
}

interface MetaRow {
  date: string
  start_receipt: number
  locked?: number
}

interface LockRow {
  locked: number
}

interface ExportRow {
  date: string
  amount: number
  receipt_no: number
  account_no: string
  name: string
  name_en: string | null
}

interface SettingRow {
  key: string
  value: string
}

function mapHolder(row: HolderRow): Holder {
  return {
    id: Number(row.id),
    name: row.name,
    nameEn: row.name_en ?? '',
    accountNo: row.account_no,
    defaultAmount: Number(row.default_amount),
    phone: row.phone ?? null,
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEntry(row: DayRow): DayEntry {
  return {
    collectionId: Number(row.collection_id),
    holderId: Number(row.holder_id),
    name: row.name,
    nameEn: row.name_en ?? '',
    accountNo: row.account_no,
    amount: Number(row.amount),
    receiptNo: Number(row.receipt_no),
    defaultAmount: Number(row.default_amount),
    createdAt: row.created_at,
  }
}

let instance: NativeRepository | null = null

export class NativeRepository implements Repository {
  private sqlite = new SQLiteConnection(CapacitorSQLite)
  private db: SQLiteDBConnection | null = null

  static get(): NativeRepository {
    if (!instance) instance = new NativeRepository()
    return instance
  }

  async init(): Promise<void> {
    const db = await this.getDb()
    await db.execute(SCHEMA)
    await this.migrate(db)
  }

  private async migrate(db: SQLiteDBConnection): Promise<void> {
    const info = await db.query('PRAGMA table_info(holders)')
    const columns = ((info.values ?? []) as TableColumnRow[]).map(
      (row) => row.name,
    )
    if (!columns.includes('name_en')) {
      await db.run(
        "ALTER TABLE holders ADD COLUMN name_en TEXT NOT NULL DEFAULT ''",
      )
    }

    const meta = await db.query('PRAGMA table_info(daily_meta)')
    const metaColumns = ((meta.values ?? []) as TableColumnRow[]).map(
      (row) => row.name,
    )
    if (!metaColumns.includes('locked')) {
      await db.run(
        'ALTER TABLE daily_meta ADD COLUMN locked INTEGER NOT NULL DEFAULT 0',
      )
    }
  }

  private async getDb(): Promise<SQLiteDBConnection> {
    if (this.db) return this.db

    const consistency = await this.sqlite.checkConnectionsConsistency()
    const isConnection = (
      await this.sqlite.isConnection(DB_NAME, false)
    ).result

    let db: SQLiteDBConnection
    if (consistency.result && isConnection) {
      db = await this.sqlite.retrieveConnection(DB_NAME, false)
    } else {
      db = await this.sqlite.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        DB_VERSION,
        false,
      )
    }

    const openState = await db.isDBOpen()
    if (!openState.result) {
      await db.open()
    }
    await db.execute('PRAGMA foreign_keys = ON;', false)
    // WAL keeps the UI responsive while writes are flushed, and NORMAL
    // synchronous is safe for this local-only app while avoiding an fsync on
    // every small transaction. These are best-effort tuning flags.
    try {
      // PRAGMA statements return a row, so they must use query() rather than
      // execute() on the Capacitor SQLite bridge.
      await db.query('PRAGMA journal_mode = WAL;')
      await db.query('PRAGMA synchronous = NORMAL;')
      await db.query('PRAGMA temp_store = MEMORY;')
      await db.query('PRAGMA cache_size = -8000;')
    } catch {
      void 0
    }
    this.db = db
    return db
  }

  async getProfile(): Promise<Profile | null> {
    const db = await this.getDb()
    const res = await db.query(
      "SELECT value FROM settings WHERE key = 'profile'",
    )
    const raw = res.values?.[0]?.value
    if (typeof raw !== 'string') return null
    try {
      return JSON.parse(raw) as Profile
    } catch {
      return null
    }
  }

  async saveProfile(profile: Profile): Promise<void> {
    const db = await this.getDb()
    await db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('profile', ?)",
      [JSON.stringify(profile)],
    )
  }

  async isSetupComplete(): Promise<boolean> {
    const db = await this.getDb()
    const res = await db.query(
      "SELECT value FROM settings WHERE key = 'setupComplete'",
    )
    return res.values?.[0]?.value === '1'
  }

  async setSetupComplete(value: boolean): Promise<void> {
    const db = await this.getDb()
    await db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('setupComplete', ?)",
      [value ? '1' : '0'],
    )
  }

  async listHolders(options: ListHoldersOptions = {}): Promise<Holder[]> {
    const db = await this.getDb()
    const status: HolderStatus = options.status ?? 'all'
    const sort: HolderSort = options.sort ?? 'account'
    const search = options.search?.trim()

    const clauses: string[] = []
    const values: unknown[] = []
    if (search) {
      clauses.push('(name LIKE ? OR name_en LIKE ? OR account_no LIKE ?)')
      values.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (status === 'active') clauses.push('active = 1')
    if (status === 'inactive') clauses.push('active = 0')

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    // Sort account numbers by numeric value ("999" before "1000", "01" == "1").
    // Pure numeric accounts come first; alphanumeric accounts follow.
    const accountKey =
      "CASE WHEN trim(account_no) <> '' AND trim(account_no) NOT GLOB '*[^0-9]*' THEN CAST(trim(account_no) AS INTEGER) ELSE NULL END"
    const order =
      sort === 'name'
        ? `ORDER BY name COLLATE NOCASE ASC, ((${accountKey}) IS NULL) ASC, ${accountKey} ASC, account_no COLLATE NOCASE ASC`
        : `ORDER BY ((${accountKey}) IS NULL) ASC, ${accountKey} ASC, account_no COLLATE NOCASE ASC`

    const res = await db.query(
      `SELECT * FROM holders ${where} ${order}`,
      values,
    )
    return ((res.values ?? []) as HolderRow[]).map(mapHolder)
  }

  async getHolder(id: number): Promise<Holder | null> {
    const db = await this.getDb()
    const res = await db.query('SELECT * FROM holders WHERE id = ?', [id])
    const row = res.values?.[0] as HolderRow | undefined
    return row ? mapHolder(row) : null
  }

  async createHolder(input: HolderInput): Promise<Holder> {
    const db = await this.getDb()
    const now = new Date().toISOString()
    const res = await db.run(
      `INSERT INTO holders
        (name, name_en, account_no, default_amount, phone, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name.trim().toUpperCase(),
        (input.nameEn ?? '').trim().toUpperCase(),
        input.accountNo.trim(),
        Math.max(0, Number(input.defaultAmount) || 0),
        input.phone?.trim() || null,
        input.active === false ? 0 : 1,
        now,
        now,
      ],
    )
    const id =
      res.changes?.lastId ??
      (await db.query('SELECT last_insert_rowid() AS id')).values?.[0]?.id
    const holder = await this.getHolder(Number(id))
    if (!holder) throw new Error('Unable to create holder')
    return holder
  }

  async updateHolder(id: number, input: HolderInput): Promise<void> {
    const db = await this.getDb()
    await db.run(
      `UPDATE holders
          SET name = ?, name_en = ?, account_no = ?, default_amount = ?,
              phone = ?, active = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.name.trim().toUpperCase(),
        (input.nameEn ?? '').trim().toUpperCase(),
        input.accountNo.trim(),
        Math.max(0, Number(input.defaultAmount) || 0),
        input.phone?.trim() || null,
        input.active === false ? 0 : 1,
        new Date().toISOString(),
        id,
      ],
    )
  }

  async setHolderActive(id: number, active: boolean): Promise<void> {
    const db = await this.getDb()
    await db.run(
      'UPDATE holders SET active = ?, updated_at = ? WHERE id = ?',
      [active ? 1 : 0, new Date().toISOString(), id],
    )
  }

  async deleteHolder(id: number): Promise<void> {
    const db = await this.getDb()
    await db.run('DELETE FROM holders WHERE id = ?', [id])
  }

  async nextAccountNo(): Promise<string> {
    const db = await this.getDb()
    const res = await db.query(
      `SELECT MAX(CAST(trim(account_no) AS INTEGER)) AS max_no
         FROM holders
        WHERE trim(account_no) <> ''
          AND trim(account_no) NOT GLOB '*[^0-9]*'`,
    )
    const max = Number(res.values?.[0]?.max_no ?? 0) || 0
    return String(max + 1).padStart(3, '0')
  }

  async getDay(date: string): Promise<DayData> {
    const db = await this.getDb()
    const meta = await db.query(
      'SELECT start_receipt, locked FROM daily_meta WHERE date = ?',
      [date],
    )
    const startReceipt = Number(meta.values?.[0]?.start_receipt ?? 1)
    const locked = Number(meta.values?.[0]?.locked ?? 0) === 1

    const res = await db.query(
      `SELECT c.id AS collection_id, c.holder_id, c.amount, c.receipt_no,
              c.created_at, h.name, h.name_en, h.account_no, h.default_amount
         FROM collections c
         JOIN holders h ON h.id = c.holder_id
        WHERE c.date = ?
        ORDER BY c.receipt_no ASC, c.id ASC`,
      [date],
    )
    const entries = ((res.values ?? []) as DayRow[]).map(mapEntry)
    return { date, startReceipt, locked, entries }
  }

  private async assertUnlocked(
    db: SQLiteDBConnection,
    date: string,
  ): Promise<void> {
    const res = await db.query(
      'SELECT locked FROM daily_meta WHERE date = ?',
      [date],
    )
    if (Number((res.values?.[0] as LockRow | undefined)?.locked ?? 0) === 1) {
      throw new Error('DAY_LOCKED')
    }
  }

  async setDayLocked(date: string, locked: boolean): Promise<void> {
    const db = await this.getDb()
    await db.run(
      `INSERT INTO daily_meta (date, start_receipt, locked)
       VALUES (?, 1, ?)
       ON CONFLICT(date) DO UPDATE SET locked = excluded.locked`,
      [date, locked ? 1 : 0],
    )
  }

  async saveCollection(
    holderId: number,
    date: string,
    amount: number,
  ): Promise<void> {
    const db = await this.getDb()
    await db.beginTransaction()
    try {
      await this.assertUnlocked(db, date)
      await db.run(
        'INSERT OR IGNORE INTO daily_meta (date, start_receipt) VALUES (?, 1)',
        [date],
        false,
      )
      const now = new Date().toISOString()
      // Compute the next receipt in SQL so adding a collection stays O(1);
      // only deletes and start-receipt changes need a full renumber.
      await db.run(
        `INSERT INTO collections
          (holder_id, date, amount, receipt_no, created_at, updated_at)
         VALUES (
           ?, ?, ?,
           MAX(
             COALESCE((SELECT start_receipt FROM daily_meta WHERE date = ?), 1),
             COALESCE((SELECT MAX(receipt_no) FROM collections WHERE date = ?), 0) + 1
           ),
           ?, ?
         )
         ON CONFLICT(holder_id, date) DO UPDATE SET
           amount = excluded.amount,
           updated_at = excluded.updated_at`,
        [
          holderId,
          date,
          Math.max(0, Number(amount) || 0),
          date,
          date,
          now,
          now,
        ],
        false,
      )
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  async saveCollectionsWithReceipts(
    date: string,
    entries: CollectionInput[],
  ): Promise<void> {
    const db = await this.getDb()
    await db.beginTransaction()
    try {
      await this.assertUnlocked(db, date)
      await db.run(
        'INSERT OR IGNORE INTO daily_meta (date, start_receipt) VALUES (?, 1)',
        [date],
        false,
      )
      const existing = await db.query(
        'SELECT receipt_no FROM collections WHERE date = ?',
        [date],
      )
      const used = new Set(
        ((existing.values ?? []) as Array<{ receipt_no: number }>).map((row) =>
          Number(row.receipt_no),
        ),
      )
      const now = new Date().toISOString()
      const statements: { statement: string; values: unknown[] }[] = []
      for (const entry of entries) {
        const receiptNo = Math.floor(Number(entry.receiptNo) || 0)
        if (receiptNo <= 0) throw new Error('INVALID_RECEIPT')
        if (used.has(receiptNo)) throw new Error('DUPLICATE_RECEIPT')
        used.add(receiptNo)
        statements.push({
          statement: `INSERT INTO collections
            (holder_id, date, amount, receipt_no, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          values: [
            entry.holderId,
            date,
            Math.max(0, Number(entry.amount) || 0),
            receiptNo,
            now,
            now,
          ],
        })
      }
      // Send the whole scan batch in one bridge call.
      if (statements.length > 0) {
        await db.executeSet(statements, false)
      }
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  async deleteCollection(holderId: number, date: string): Promise<void> {
    const db = await this.getDb()
    await db.beginTransaction()
    try {
      await this.assertUnlocked(db, date)
      await db.run(
        'DELETE FROM collections WHERE holder_id = ? AND date = ?',
        [holderId, date],
        false,
      )
      await this.renumberDate(db, date)
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  async setStartReceipt(date: string, start: number): Promise<void> {
    const db = await this.getDb()
    const value = Math.max(1, Math.floor(Number(start) || 1))
    await db.beginTransaction()
    try {
      await this.assertUnlocked(db, date)
      await db.run(
        `INSERT INTO daily_meta (date, start_receipt) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET start_receipt = excluded.start_receipt`,
        [date, value],
        false,
      )
      await this.renumberDate(db, date)
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  private async renumberDate(
    db: SQLiteDBConnection,
    date: string,
  ): Promise<void> {
    // One statement instead of one bridge round-trip per collection row.
    await db.run(
      `UPDATE collections
          SET receipt_no =
              COALESCE(
                (SELECT start_receipt FROM daily_meta WHERE date = ?), 1
              ) + (
                SELECT COUNT(*)
                  FROM collections c2
                 WHERE c2.date = collections.date
                   AND c2.id < collections.id
              )
        WHERE date = ?`,
      [date, date],
      false,
    )
  }

  async getMonthlyReport(month: string): Promise<MonthlyReport> {
    const db = await this.getDb()
    const { start, end } = commissionPeriod(month)
    const res = await db.query(
      `SELECT c.holder_id, c.date, c.amount, h.name, h.name_en, h.account_no
         FROM collections c
         JOIN holders h ON h.id = c.holder_id
        WHERE c.date >= ? AND c.date <= ?
        ORDER BY c.date ASC, c.id ASC`,
      [start, end],
    )
    const rows = ((res.values ?? []) as ReportRow[]).map((row) => ({
      holderId: Number(row.holder_id),
      name: row.name,
      nameEn: row.name_en ?? '',
      accountNo: row.account_no,
      date: row.date,
      amount: Number(row.amount),
    }))
    return buildMonthlyReport(month, rows)
  }

  async getHolderHistory(id: number): Promise<HolderHistory | null> {
    const holder = await this.getHolder(id)
    if (!holder) return null

    const db = await this.getDb()
    const res = await db.query(
      `SELECT date, amount, receipt_no
         FROM collections
        WHERE holder_id = ?
        ORDER BY date DESC`,
      [id],
    )
    const entries = ((res.values ?? []) as HistoryRow[]).map((row) => ({
      date: row.date,
      amount: Number(row.amount),
      receiptNo: Number(row.receipt_no),
    }))
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
    const dates = entries.map((entry) => entry.date).sort()

    return {
      holder,
      entries,
      total,
      days: entries.length,
      firstDate: dates.length ? dates[0] : null,
      lastDate: dates.length ? dates[dates.length - 1] : null,
    }
  }

  async exportBackup(): Promise<BackupData> {
    const db = await this.getDb()
    const settingsRes = await db.query('SELECT key, value FROM settings')
    const settings = ((settingsRes.values ?? []) as SettingRow[]).reduce<
      Record<string, string>
    >((acc, row) => {
      acc[row.key] = row.value
      return acc
    }, {})

    let profile: Profile | null = null
    if (settings.profile) {
      try {
        profile = JSON.parse(settings.profile) as Profile
      } catch {
        profile = null
      }
    }

    const holdersRes = await db.query(
      'SELECT * FROM holders ORDER BY id ASC',
    )
    const collectionsRes = await db.query(
      `SELECT id, holder_id, date, amount, receipt_no, created_at, updated_at
         FROM collections
        ORDER BY id ASC`,
    )
    const metaRes = await db.query(
      'SELECT date, start_receipt, locked FROM daily_meta ORDER BY date ASC',
    )

    const collections = ((collectionsRes.values ?? []) as ExportCollectionRow[]).map(
      (row) => ({
        holderId: Number(row.holder_id),
        date: row.date,
        amount: Number(row.amount),
        receiptNo: Number(row.receipt_no),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    )

    const dailyMeta: Record<string, number> = {}
    const locks: Record<string, boolean> = {}
    for (const row of (metaRes.values ?? []) as MetaRow[]) {
      dailyMeta[row.date] = Number(row.start_receipt)
      if (Number(row.locked ?? 0) === 1) locks[row.date] = true
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      setupComplete: settings.setupComplete === '1',
      locks,
      holders: ((holdersRes.values ?? []) as HolderRow[]).map((row) => ({
        id: Number(row.id),
        name: row.name,
        nameEn: row.name_en ?? '',
        accountNo: row.account_no,
        defaultAmount: Number(row.default_amount),
        phone: row.phone ?? null,
        active: Number(row.active) === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      collections,
      dailyMeta,
    }
  }

  async importBackup(data: BackupData): Promise<void> {
    const db = await this.getDb()
    await db.beginTransaction()
    try {
      const statements: { statement: string; values: unknown[] }[] = [
        { statement: 'DELETE FROM collections', values: [] },
        { statement: 'DELETE FROM holders', values: [] },
        { statement: 'DELETE FROM daily_meta', values: [] },
        { statement: 'DELETE FROM settings', values: [] },
      ]

      if (data.profile) {
        statements.push({
          statement: "INSERT INTO settings (key, value) VALUES ('profile', ?)",
          values: [JSON.stringify(data.profile)],
        })
      }
      statements.push({
        statement:
          "INSERT INTO settings (key, value) VALUES ('setupComplete', ?)",
        values: [data.setupComplete ? '1' : '0'],
      })

      for (const holder of data.holders) {
        statements.push({
          statement: `INSERT INTO holders
            (id, name, name_en, account_no, default_amount, phone, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            holder.id,
            holder.name,
            holder.nameEn ?? '',
            holder.accountNo,
            Math.max(0, Number(holder.defaultAmount) || 0),
            holder.phone ?? null,
            holder.active ? 1 : 0,
            holder.createdAt,
            holder.updatedAt,
          ],
        })
      }

      for (const collection of data.collections) {
        statements.push({
          statement: `INSERT INTO collections
            (holder_id, date, amount, receipt_no, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          values: [
            collection.holderId,
            collection.date,
            Math.max(0, Number(collection.amount) || 0),
            Math.max(0, Number(collection.receiptNo) || 0),
            collection.createdAt,
            collection.updatedAt,
          ],
        })
      }

      const metaDates = new Set([
        ...Object.keys(data.dailyMeta ?? {}),
        ...Object.keys(data.locks ?? {}),
      ])
      for (const date of metaDates) {
        const start = data.dailyMeta?.[date] ?? 1
        statements.push({
          statement:
            'INSERT OR REPLACE INTO daily_meta (date, start_receipt, locked) VALUES (?, ?, ?)',
          values: [
            date,
            Math.max(1, Math.floor(Number(start) || 1)),
            data.locks?.[date] ? 1 : 0,
          ],
        })
      }

      // One bridge call for the whole restore instead of one per row.
      await db.executeSet(statements, false)
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  async exportCollections(
    start: string,
    end: string,
  ): Promise<CollectionExport> {
    const db = await this.getDb()
    const metaRes = await db.query(
      `SELECT date, start_receipt, locked FROM daily_meta
        WHERE date >= ? AND date <= ?
        ORDER BY date ASC`,
      [start, end],
    )
    const dailyMeta: Record<string, number> = {}
    const locks: Record<string, boolean> = {}
    for (const row of (metaRes.values ?? []) as MetaRow[]) {
      dailyMeta[row.date] = Number(row.start_receipt)
      if (Number(row.locked ?? 0) === 1) locks[row.date] = true
    }

    const res = await db.query(
      `SELECT c.date, c.amount, c.receipt_no, h.account_no, h.name, h.name_en
         FROM collections c
         JOIN holders h ON h.id = c.holder_id
        WHERE c.date >= ? AND c.date <= ?
        ORDER BY c.date ASC, c.receipt_no ASC, c.id ASC`,
      [start, end],
    )
    const collections = ((res.values ?? []) as ExportRow[]).map((row) => ({
      accountNo: row.account_no,
      name: row.name_en && row.name_en !== '' ? row.name_en : row.name,
      date: row.date,
      amount: Number(row.amount),
      receiptNo: Number(row.receipt_no),
    }))

    return {
      type: 'collection-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      range: { start, end },
      dailyMeta,
      locks,
      collections,
    }
  }

  async importCollections(
    data: CollectionExport,
  ): Promise<CollectionImportResult> {
    const db = await this.getDb()
    await db.beginTransaction()
    try {
      const holdersRes = await db.query(
        'SELECT id, name, name_en, account_no, default_amount, phone, active, created_at, updated_at FROM holders',
      )
      const holderByAccount = new Map<string, number>()
      for (const row of (holdersRes.values ?? []) as HolderRow[]) {
        holderByAccount.set(String(row.account_no).trim(), Number(row.id))
      }

      const lockedRes = await db.query(
        'SELECT date FROM daily_meta WHERE locked = 1',
      )
      const lockedDates = new Set(
        ((lockedRes.values ?? []) as { date: string }[]).map((row) => row.date),
      )

      const now = new Date().toISOString()
      const rows = [...data.collections].sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.receiptNo - b.receiptNo,
      )
      const minReceipt = new Map<string, number>()
      const affected = new Set<string>()
      const upserts: { statement: string; values: unknown[] }[] = []
      let imported = 0
      let skipped = 0

      for (const row of rows) {
        if (lockedDates.has(row.date)) {
          skipped += 1
          continue
        }
        const holderId = holderByAccount.get(String(row.accountNo).trim())
        if (!holderId) {
          skipped += 1
          continue
        }
        const receiptNo = Math.max(0, Math.floor(Number(row.receiptNo) || 0))
        const previous = minReceipt.get(row.date)
        if (receiptNo > 0 && (previous === undefined || receiptNo < previous)) {
          minReceipt.set(row.date, receiptNo)
        }
        affected.add(row.date)
        upserts.push({
          statement: `INSERT INTO collections
              (holder_id, date, amount, receipt_no, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(holder_id, date) DO UPDATE SET
               amount = excluded.amount,
               receipt_no = excluded.receipt_no,
               updated_at = excluded.updated_at`,
          values: [
            holderId,
            row.date,
            Math.max(0, Number(row.amount) || 0),
            receiptNo,
            now,
            now,
          ],
        })
        imported += 1
      }

      const metaDates = new Set([
        ...affected,
        ...Object.keys(data.locks ?? {}),
      ])
      const meta: { statement: string; values: unknown[] }[] = []
      for (const date of metaDates) {
        const fromFile = data.dailyMeta?.[date]
        const start =
          fromFile !== undefined
            ? Math.max(1, Math.floor(Number(fromFile) || 1))
            : Math.max(1, minReceipt.get(date) ?? 1)
        const lockFlag = data.locks?.[date] ? 1 : 0
        meta.push({
          statement: `INSERT INTO daily_meta (date, start_receipt, locked)
             VALUES (?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
               start_receipt = daily_meta.start_receipt,
               locked = CASE WHEN excluded.locked = 1 THEN 1 ELSE daily_meta.locked END`,
          values: [date, start, lockFlag],
        })
      }

      const statements = [...meta, ...upserts]
      if (statements.length > 0) {
        await db.executeSet(statements, false)
      }
      for (const date of affected) {
        await this.renumberDate(db, date)
      }
      await db.commitTransaction()
      return { imported, skipped, dates: affected.size }
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }

  async seedDemoData(profile: Profile): Promise<void> {
    await this.saveProfile(profile)
    await this.setSetupComplete(true)

    const db = await this.getDb()
    const count = await db.query('SELECT COUNT(*) AS count FROM holders')
    if (Number(count.values?.[0]?.count ?? 0) > 0) return

    const now = new Date().toISOString()
    const date = todayIso()
    await db.beginTransaction()
    try {
      for (const holder of DEMO_HOLDERS) {
        await db.run(
          `INSERT INTO holders
            (name, account_no, default_amount, phone, active, created_at, updated_at)
           VALUES (?, ?, ?, NULL, 1, ?, ?)`,
          [
            holder.name,
            holder.accountNo,
            holder.defaultAmount,
            now,
            now,
          ],
          false,
        )
      }
      await db.run(
        `INSERT INTO daily_meta (date, start_receipt) VALUES (?, 1)
         ON CONFLICT(date) DO UPDATE SET start_receipt = excluded.start_receipt`,
        [date],
        false,
      )
      for (let i = 0; i < DEMO_COLLECTED_COUNT; i += 1) {
        const holder = DEMO_HOLDERS[i]
        const found = await db.query(
          'SELECT id FROM holders WHERE account_no = ?',
          [holder.accountNo],
        )
        const holderId = found.values?.[0]?.id
        if (holderId) {
          await db.run(
            `INSERT INTO collections
              (holder_id, date, amount, receipt_no, created_at, updated_at)
             VALUES (?, ?, ?, 0, ?, ?)`,
            [holderId, date, holder.defaultAmount, now, now],
            false,
          )
        }
      }
      await this.renumberDate(db, date)
      await db.commitTransaction()
    } catch (err) {
      try {
        await db.rollbackTransaction()
      } catch {
        void 0
      }
      throw err
    }
  }
}
