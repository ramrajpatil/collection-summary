import { beforeEach, describe, expect, it } from 'vitest'
import { WebRepository } from './repo.web'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage

const DATE = '2026-11-20'

async function setup() {
  const repo = WebRepository.get()
  await repo.init()
  const a = await repo.createHolder({ name: 'A', accountNo: '001', defaultAmount: 100 })
  const b = await repo.createHolder({ name: 'B', accountNo: '002', defaultAmount: 100 })
  const c = await repo.createHolder({ name: 'C', accountNo: '003', defaultAmount: 100 })
  await repo.saveCollection(a.id, DATE, 100)
  await repo.saveCollection(b.id, DATE, 200)
  await repo.saveCollection(c.id, DATE, 300)
  return { repo, a, b, c }
}

describe('collection receipts', () => {
  beforeEach(() => {
    store.clear()
  })

  it('assigns consecutive receipts as collections are added', async () => {
    const { repo } = await setup()
    const day = await repo.getDay(DATE)
    expect(day.entries.map((entry) => entry.receiptNo)).toEqual([1, 2, 3])
  })

  it('keeps the receipt number when only the amount is updated', async () => {
    const { repo, a } = await setup()
    await repo.updateCollection(a.id, DATE, 999)
    const day = await repo.getDay(DATE)
    expect(day.entries.map((entry) => [entry.name, entry.receiptNo, entry.amount])).toEqual([
      ['A', 1, 999],
      ['B', 2, 200],
      ['C', 3, 300],
    ])
  })

  it('renumbers remaining receipts when a collection is deleted', async () => {
    const { repo, a } = await setup()
    await repo.deleteCollection(a.id, DATE)
    const day = await repo.getDay(DATE)
    expect(day.entries.map((entry) => [entry.name, entry.receiptNo])).toEqual([
      ['B', 1],
      ['C', 2],
    ])
  })

  it('reassigns a collection to another holder and keeps the receipt number', async () => {
    const { repo, a } = await setup()
    const d = await repo.createHolder({
      name: 'D',
      accountNo: '004',
      defaultAmount: 100,
    })
    await repo.reassignCollection(DATE, a.id, d.id)
    const day = await repo.getDay(DATE)
    expect(day.entries.map((entry) => [entry.name, entry.receiptNo, entry.amount])).toEqual([
      ['D', 1, 100],
      ['B', 2, 200],
      ['C', 3, 300],
    ])
  })

  it('rejects reassigning onto a holder that is already collected', async () => {
    const { repo, a, b } = await setup()
    await expect(repo.reassignCollection(DATE, a.id, b.id)).rejects.toThrow(
      'ALREADY_COLLECTED',
    )
  })

  it('inserts a collection at a receipt and shifts the later ones', async () => {
    const { repo } = await setup()
    const d = await repo.createHolder({
      name: 'D',
      accountNo: '004',
      defaultAmount: 50,
    })
    // Insert after B (receipt 2) -> new entry takes receipt 2, C moves to 4.
    await repo.insertCollectionAtReceipt(DATE, d.id, 50, 3)
    const day = await repo.getDay(DATE)
    expect(
      day.entries.map((entry) => [entry.name, entry.receiptNo, entry.amount]),
    ).toEqual([
      ['A', 1, 100],
      ['B', 2, 200],
      ['D', 3, 50],
      ['C', 4, 300],
    ])
  })

  it('clearDay wipes every collection for the date', async () => {
    const { repo } = await setup()
    await repo.clearDay(DATE)
    const day = await repo.getDay(DATE)
    expect(day.entries).toEqual([])
  })

  it('importCollections appends new days and keeps existing days intact', async () => {
    const { repo } = await setup()
    const nextDate = '2026-11-21'
    const file = {
      type: 'collection-export' as const,
      version: 1,
      exportedAt: new Date().toISOString(),
      range: { start: nextDate, end: nextDate },
      dailyMeta: {},
      locks: {},
      collections: [
        {
          accountNo: '001',
          name: 'A',
          date: nextDate,
          amount: 150,
          receiptNo: 1,
        },
      ],
    }

    const result = await repo.importCollections(file)
    expect(result.imported).toBe(1)

    const existing = await repo.getDay(DATE)
    expect(
      existing.entries.map((entry) => [entry.name, entry.amount]),
    ).toEqual([
      ['A', 100],
      ['B', 200],
      ['C', 300],
    ])

    const imported = await repo.getDay(nextDate)
    expect(imported.entries.map((entry) => [entry.name, entry.amount])).toEqual([
      ['A', 150],
    ])

    await repo.importCollections(file)
    const again = await repo.getDay(nextDate)
    expect(again.entries).toHaveLength(1)
  })

  it('reports why imported rows were skipped', async () => {
    const { repo } = await setup()
    const lockedDate = '2026-11-22'
    await repo.setDayLocked(lockedDate, true)

    const result = await repo.importCollections({
      type: 'collection-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      range: { start: '2026-11-21', end: '2026-11-23' },
      dailyMeta: {},
      locks: {},
      collections: [
        {
          accountNo: '001',
          name: 'A',
          date: '2026-11-21',
          amount: 100,
          receiptNo: 1,
        },
        {
          accountNo: '001',
          name: 'A',
          date: lockedDate,
          amount: 100,
          receiptNo: 1,
        },
        {
          accountNo: '999',
          name: 'Unknown',
          date: '2026-11-23',
          amount: 100,
          receiptNo: 1,
        },
      ],
    })

    expect(result.imported).toBe(1)
    expect(result.skippedLocked).toBe(1)
    expect(result.skippedUnknown).toBe(1)
    expect(result.skipped).toBe(2)
  })

  it('keeps the receipt numbers from the file on a fresh day', async () => {
    const { repo } = await setup()
    const nextDate = '2026-11-21'
    await repo.importCollections({
      type: 'collection-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      range: { start: nextDate, end: nextDate },
      dailyMeta: { [nextDate]: 5 },
      locks: {},
      collections: [
        {
          accountNo: '001',
          name: 'A',
          date: nextDate,
          amount: 100,
          receiptNo: 5,
        },
        {
          accountNo: '002',
          name: 'B',
          date: nextDate,
          amount: 200,
          receiptNo: 6,
        },
      ],
    })

    const day = await repo.getDay(nextDate)
    expect(day.startReceipt).toBe(5)
    expect(
      day.entries.map((entry) => [entry.name, entry.receiptNo, entry.amount]),
    ).toEqual([
      ['A', 5, 100],
      ['B', 6, 200],
    ])
  })

  it('moves every collection of a day to another date', async () => {
    const { repo } = await setup()
    const target = '2026-11-21'
    await repo.moveDay(DATE, target)

    expect((await repo.getDay(DATE)).entries).toEqual([])
    const moved = await repo.getDay(target)
    expect(
      moved.entries.map((entry) => [entry.name, entry.amount, entry.receiptNo]),
    ).toEqual([
      ['A', 100, 1],
      ['B', 200, 2],
      ['C', 300, 3],
    ])
  })

  it('refuses to move onto a date that already has collections', async () => {
    const { repo } = await setup()
    await expect(repo.moveDay(DATE, DATE)).rejects.toThrow('SAME_DAY')
    const other = '2026-11-21'
    await repo.saveCollection(
      (await repo.createHolder({
        name: 'D',
        accountNo: '004',
        defaultAmount: 100,
      })).id,
      other,
      100,
    )
    await expect(repo.moveDay(DATE, other)).rejects.toThrow(
      'TARGET_NOT_EMPTY',
    )
  })
})
