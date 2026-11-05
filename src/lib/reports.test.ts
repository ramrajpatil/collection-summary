import { describe, expect, it } from 'vitest'
import {
  buildMonthlyReport,
  commissionFor,
  commissionPeriod,
  shiftMonth,
} from './reports'

describe('commissionFor', () => {
  it('rounds to two decimals at 3%', () => {
    expect(commissionFor(1000)).toBe(30)
    expect(commissionFor(333)).toBe(9.99)
    expect(commissionFor(0)).toBe(0)
  })
})

describe('commissionPeriod', () => {
  it('covers the whole calendar month', () => {
    expect(commissionPeriod('2026-03')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    })
    expect(commissionPeriod('2026-01')).toEqual({
      start: '2026-01-01',
      end: '2026-01-31',
    })
  })

  it('ends on the last day of the month, including leap years', () => {
    expect(commissionPeriod('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(commissionPeriod('2024-02')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    })
  })
})

describe('buildMonthlyReport', () => {
  it('aggregates per holder and per day for the month', () => {
    const report = buildMonthlyReport('2026-03', [
      {
        holderId: 1,
        name: 'A',
        nameEn: '',
        accountNo: '001',
        date: '2026-03-01',
        amount: 100,
      },
      {
        holderId: 1,
        name: 'A',
        nameEn: '',
        accountNo: '001',
        date: '2026-03-02',
        amount: 50,
      },
      {
        holderId: 2,
        name: 'B',
        nameEn: '',
        accountNo: '002',
        date: '2026-03-01',
        amount: 200,
      },
      {
        holderId: 2,
        name: 'B',
        nameEn: '',
        accountNo: '002',
        date: '2026-03-31',
        amount: 999,
      },
    ])

    expect(report.total).toBe(1349)
    expect(report.accounts).toBe(2)
    expect(report.days).toBe(3)
    expect(report.commission).toBe(40.47)
    expect(report.holders[0]).toMatchObject({
      accountNo: '001',
      days: 2,
      total: 150,
      commission: 4.5,
    })
    expect(report.holders[1]).toMatchObject({
      accountNo: '002',
      days: 2,
      total: 1199,
    })
    expect(report.daily.map((day) => day.total)).toEqual([300, 50, 999])
  })
})

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-06', 0)).toBe('2026-06')
  })
})