import type { MonthlyReport } from './models'
import { compareAccountNo } from './sort'

export const COMMISSION_RATE = 0.03

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function commissionFor(total: number): number {
  return round2(total * COMMISSION_RATE)
}

export function commissionPeriod(month: string): {
  start: string
  end: string
} {
  const [year, monthNo] = month.split('-').map(Number)
  const prevMonth = monthNo === 1 ? 12 : monthNo - 1
  const prevYear = monthNo === 1 ? year - 1 : year
  const prevDays = daysInMonth(prevYear, prevMonth)

  const start =
    prevDays === 31
      ? isoDate(prevYear, prevMonth, 31)
      : isoDate(year, monthNo, 1)
  const end = isoDate(
    year,
    monthNo,
    Math.min(30, daysInMonth(year, monthNo)),
  )

  return { start, end }
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNo] = month.split('-').map(Number)
  const date = new Date(year, monthNo - 1 + delta, 1)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export interface ReportSourceRow {
  holderId: number
  name: string
  nameEn: string
  accountNo: string
  date: string
  amount: number
}

export function buildMonthlyReport(
  month: string,
  rows: ReportSourceRow[],
): MonthlyReport {
  const { start, end } = commissionPeriod(month)
  const periodRows = rows.filter((row) => row.date >= start && row.date <= end)

  const holderMap = new Map<
    number,
    {
      holderId: number
      name: string
      nameEn: string
      accountNo: string
      dates: Set<string>
      total: number
    }
  >()
  const dayMap = new Map<string, { total: number; count: number }>()
  let total = 0

  for (const row of periodRows) {
    total += row.amount
    const holder = holderMap.get(row.holderId) ?? {
      holderId: row.holderId,
      name: row.name,
      nameEn: row.nameEn,
      accountNo: row.accountNo,
      dates: new Set<string>(),
      total: 0,
    }
    holder.dates.add(row.date)
    holder.total += row.amount
    holderMap.set(row.holderId, holder)

    const day = dayMap.get(row.date) ?? { total: 0, count: 0 }
    day.total += row.amount
    day.count += 1
    dayMap.set(row.date, day)
  }

  const holders = [...holderMap.values()]
    .map((holder) => ({
      holderId: holder.holderId,
      name: holder.name,
      nameEn: holder.nameEn,
      accountNo: holder.accountNo,
      days: holder.dates.size,
      total: round2(holder.total),
      commission: commissionFor(holder.total),
    }))
    .sort((a, b) => compareAccountNo(a.accountNo, b.accountNo))

  const daily = [...dayMap.entries()]
    .map(([date, value]) => ({
      date,
      total: round2(value.total),
      count: value.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    month,
    periodStart: start,
    periodEnd: end,
    total: round2(total),
    commission: commissionFor(total),
    days: daily.length,
    accounts: holders.length,
    holders,
    daily,
  }
}
