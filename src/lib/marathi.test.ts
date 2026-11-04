import { describe, expect, it } from 'vitest'
import { shiftIsoDate } from './marathi'

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