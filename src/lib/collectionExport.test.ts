import { describe, expect, it } from 'vitest'
import type { CollectionExport } from './models'
import {
  collectionExportCsv,
  collectionExportFileName,
  collectionMonthDaySummaries,
  parseCollectionExport,
  serializeCollectionExport,
  summarizeCollectionExport,
} from './collectionExport'

const sample: CollectionExport = {
  type: 'collection-export',
  version: 1,
  exportedAt: '2026-11-04T10:00:00.000Z',
  range: { start: '2026-11-01', end: '2026-11-04' },
  dailyMeta: { '2026-11-01': 5, '2026-11-04': 1 },
  locks: { '2026-11-04': true },
  collections: [
    {
      accountNo: '001',
      name: 'RAMESH',
      date: '2026-11-01',
      amount: 100,
      receiptNo: 5,
    },
    {
      accountNo: '002',
      name: 'SURESH',
      date: '2026-11-04',
      amount: 250,
      receiptNo: 1,
    },
  ],
}

describe('collection export', () => {
  it('round trips through JSON', () => {
    expect(parseCollectionExport(serializeCollectionExport(sample))).toEqual(
      sample,
    )
  })

  it('writes the locked flag to CSV', () => {
    const csv = collectionExportCsv(sample)
    expect(csv.split('\r\n')[0]).toBe(
      'Date,Account No,Name,Receipt No,Amount,Locked',
    )
    expect(csv).toContain('2026-11-01,001,RAMESH,5,100,NO')
    expect(csv).toContain('2026-11-04,002,SURESH,1,250,YES')
  })

  it('drops the receipt column when receipts are disabled', () => {
    const csv = collectionExportCsv(sample, false)
    expect(csv.split('\r\n')[0]).toBe('Date,Account No,Name,Amount,Locked')
    expect(csv).toContain('2026-11-01,001,RAMESH,100,NO')
    expect(csv).toContain('2026-11-04,002,SURESH,250,YES')
  })

  it('summarizes rows, days, total and file name', () => {
    expect(summarizeCollectionExport(sample)).toEqual({
      start: '2026-11-01',
      end: '2026-11-04',
      rows: 2,
      days: 2,
      total: 350,
    })
    expect(collectionExportFileName(sample, 'json')).toBe(
      'collection-2026-11-01_to_2026-11-04.json',
    )
  })

  it('rejects invalid exports', () => {
    expect(() => parseCollectionExport('{bad')).toThrow('INVALID_JSON')
    expect(() => parseCollectionExport('{"foo":1}')).toThrow('INVALID_EXPORT')
  })

  it('summarizes each day with the number of accounts and amount', () => {
    const months = collectionMonthDaySummaries({
      ...sample,
      range: { start: '2026-10-31', end: '2026-11-02' },
      collections: [
        {
          accountNo: '001',
          name: 'A',
          date: '2026-10-31',
          amount: 100,
          receiptNo: 1,
        },
        {
          accountNo: '001',
          name: 'A',
          date: '2026-11-01',
          amount: 100,
          receiptNo: 1,
        },
        {
          accountNo: '002',
          name: 'B',
          date: '2026-11-01',
          amount: 200,
          receiptNo: 2,
        },
        {
          accountNo: '003',
          name: 'C',
          date: '2026-11-01',
          amount: 300,
          receiptNo: 3,
        },
        {
          accountNo: '002',
          name: 'B',
          date: '2026-11-02',
          amount: 200,
          receiptNo: 2,
        },
      ],
    })

    expect(months.map((month) => month.month)).toEqual([
      '2026-10',
      '2026-11',
    ])
    expect(months[0]).toMatchObject({
      month: '2026-10',
      dayCount: 1,
      accounts: 1,
      total: 100,
    })
    expect(months[0].days).toEqual([
      { date: '2026-10-31', accounts: 1, total: 100 },
    ])
    expect(months[1]).toMatchObject({
      month: '2026-11',
      dayCount: 2,
      accounts: 4,
      total: 800,
    })
    expect(months[1].days).toEqual([
      { date: '2026-11-01', accounts: 3, total: 600 },
      { date: '2026-11-02', accounts: 1, total: 200 },
    ])
  })
})