import { describe, expect, it } from 'vitest'
import type { BackupData } from './models'
import {
  backupFileName,
  parseBackup,
  serializeBackup,
} from './backup'

const sample: BackupData = {
  version: 1,
  exportedAt: '2026-11-04T10:00:00.000Z',
  profile: {
    societyName: 'Shri Ganesh',
    address: 'Shirol',
    agentName: 'Sachin',
    managerName: 'Manager',
  },
  setupComplete: true,
  holders: [
    {
      id: 1,
      name: 'Ramesh',
      nameEn: 'RAMESH',
      accountNo: '001',
      defaultAmount: 100,
      phone: '9876543210',
      active: true,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
  ],
  collections: [
    {
      holderId: 1,
      date: '2026-11-04',
      amount: 100,
      receiptNo: 1,
      createdAt: '2026-11-04T10:00:00.000Z',
      updatedAt: '2026-11-04T10:00:00.000Z',
    },
  ],
  dailyMeta: { '2026-11-04': 1 },
}

describe('backup round trip', () => {
  it('restores what it serialized', () => {
    const text = serializeBackup(sample)
    expect(parseBackup(text)).toEqual(sample)
  })
})

describe('parseBackup', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow('INVALID_JSON')
  })

  it('rejects objects without holder and collection arrays', () => {
    expect(() => parseBackup('{"profile":null}')).toThrow('INVALID_BACKUP')
  })

  it('drops malformed rows and coerces missing fields', () => {
    const parsed = parseBackup(
      JSON.stringify({
        holders: [{ id: 1, name: 'X', accountNo: '001' }, { name: 'no id' }],
        collections: [{ holderId: 1, date: '2026-01-01', amount: 10 }],
      }),
    )
    expect(parsed.holders).toHaveLength(1)
    expect(parsed.holders[0]).toMatchObject({
      id: 1,
      defaultAmount: 0,
      active: true,
    })
    expect(parsed.collections).toHaveLength(1)
    expect(parsed.collections[0].receiptNo).toBe(0)
    expect(parsed.setupComplete).toBe(false)
    expect(parsed.profile).toBeNull()
  })
})

describe('backupFileName', () => {
  it('embeds a stable timestamp', () => {
    expect(backupFileName(new Date(2026, 10, 4, 9, 5))).toBe(
      'collection-backup-20261104-0905.json',
    )
  })
})