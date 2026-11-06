import { describe, expect, it } from 'vitest'
import type { CollectionExport } from './models'
import {
  collectionExportCsv,
  collectionExportFileName,
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
})