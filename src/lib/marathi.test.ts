import { describe, expect, it } from 'vitest'
import {
  formatReceipt,
  formatWeekday,
  isSunday,
  shiftIsoDate,
  toLatinDigits,
} from './marathi'

describe('shiftIsoDate', () => {
  it('moves backwards within a month', () => {
    expect(shiftIsoDate('2026-11-04', -3)).toBe('2026-11-01')
  })

  it('crosses month boundaries', () => {
    expect(shiftIsoDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('crosses year boundaries', () => {
    expect(shiftIsoDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('returns the input unchanged when invalid', () => {
    expect(shiftIsoDate('not-a-date', 1)).toBe('not-a-date')
  })
})

describe('formatReceipt', () => {
  it('pads receipt numbers to four digits', () => {
    expect(formatReceipt(1, 'en')).toBe('0001')
    expect(formatReceipt(42, 'en')).toBe('0042')
    expect(formatReceipt('7', 'en')).toBe('0007')
    expect(formatReceipt(1234, 'en')).toBe('1234')
  })

  it('uses Devanagari digits for Marathi', () => {
    expect(formatReceipt(9)).toBe('०००९')
  })
})

describe('toLatinDigits', () => {
  it('converts Devanagari digits back to Latin', () => {
    expect(toLatinDigits('००४२')).toBe('0042')
    expect(toLatinDigits('०१२३४५६७८९')).toBe('0123456789')
    expect(toLatinDigits('12')).toBe('12')
  })
})

describe('formatWeekday', () => {
  it('returns the Marathi weekday name', () => {
    expect(formatWeekday('2026-11-01')).toBe('रविवार')
    expect(formatWeekday('2026-11-20')).toBe('शुक्रवार')
  })

  it('returns the English weekday name', () => {
    expect(formatWeekday('2026-11-01', 'en')).toBe('Sunday')
    expect(formatWeekday('2026-11-20', 'en')).toBe('Friday')
  })

  it('returns a short form for table rows', () => {
    expect(formatWeekday('2026-11-01', 'mr', true)).toBe('रवि')
    expect(formatWeekday('2026-11-01', 'en', true)).toBe('Sun')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatWeekday('not-a-date')).toBe('')
  })
})

describe('isSunday', () => {
  it('detects Sundays and other days', () => {
    expect(isSunday('2026-11-01')).toBe(true)
    expect(isSunday('2026-11-20')).toBe(false)
    expect(isSunday('bad')).toBe(false)
  })
})