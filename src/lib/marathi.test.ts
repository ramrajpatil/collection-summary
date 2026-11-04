import { describe, expect, it } from 'vitest'
import { formatReceipt, shiftIsoDate } from './marathi'

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