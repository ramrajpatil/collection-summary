import { describe, expect, it } from 'vitest'
import {
  buildMonthlyReport,
  buildMonthlyReportFromSummary,
  calendarMonthPeriod,
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
  it('runs from the 30th of the previous month to the 29th', () => {
    expect(commissionPeriod('2026-01')).toEqual({
      start: '2025-12-30',
      end: '2026-01-29',
    })
    expect(commissionPeriod('2026-07')).toEqual({
      start: '2026-06-30',
      end: '2026-07-29',
    })
  })

  it('rolls the 30th and 31st into the next month', () => {
    expect(commissionPeriod('2026-07')).toEqual({
      start: '2026-06-30',
      end: '2026-07-29',
    })
    expect(commissionPeriod('2026-08')).toEqual({
      start: '2026-07-30',
      end: '2026-08-29',
    })
  })

  it('starts on the 1st when the previous month has no 30th', () => {
    expect(commissionPeriod('2026-03')).toEqual({
      start: '2026-03-01',
      end: '2026-03-29',
    })
  })

  it('ends on the last day of February', () => {
    expect(commissionPeriod('2026-02')).toEqual({
      start: '2026-01-30',
      end: '2026-02-28',
    })
    expect(commissionPeriod('2024-02')).toEqual({
      start: '2024-01-30',
      end: '2024-02-29',
    })
  })
})

describe('calendarMonthPeriod', () => {
  it('covers the whole calendar month', () => {
    expect(calendarMonthPeriod('2026-03')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    })
    expect(calendarMonthPeriod('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
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
        date: '2026-03-29',
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

describe('buildMonthlyReportFromSummary', () => {
  it('matches buildMonthlyReport output for the same data', () => {
    const rows = [
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
        amount: 50.25,
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
        date: '2026-03-29',
        amount: 999,
      },
    ]

    const expected = buildMonthlyReport('2026-03', rows)
    const actual = buildMonthlyReportFromSummary(
      '2026-03',
      [
        {
          holderId: 1,
          name: 'A',
          nameEn: '',
          accountNo: '001',
          days: 2,
          total: 150.25,
        },
        {
          holderId: 2,
          name: 'B',
          nameEn: '',
          accountNo: '002',
          days: 2,
          total: 1199,
        },
      ],
      [
        { date: '2026-03-01', total: 300, count: 2 },
        { date: '2026-03-02', total: 50.25, count: 1 },
        { date: '2026-03-29', total: 999, count: 1 },
      ],
    )

    expect(actual).toEqual(expected)
  })
})

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-06', 0)).toBe('2026-06')
  })
})