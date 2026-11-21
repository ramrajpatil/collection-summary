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
})
