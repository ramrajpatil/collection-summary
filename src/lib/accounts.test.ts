import { describe, expect, it } from 'vitest'
import {
  accountDigits,
  accountSearchScore,
  expandAccountNo,
  rankByAccount,
} from './accounts'

describe('expandAccountNo', () => {
  it('inserts "00" after the series digit and pads the sequence', () => {
    expect(expandAccountNo('41')).toBe('40001')
    expect(expandAccountNo('43')).toBe('40003')
    expect(expandAccountNo('437')).toBe('40037')
    expect(expandAccountNo('61')).toBe('60001')
    expect(expandAccountNo('634')).toBe('60034')
    expect(expandAccountNo('58')).toBe('50008')
    expect(expandAccountNo('57')).toBe('50007')
    expect(expandAccountNo('412')).toBe('40012')
    expect(expandAccountNo('512')).toBe('50012')
    expect(expandAccountNo('612')).toBe('60012')
  })

  it('leaves full account numbers untouched', () => {
    expect(expandAccountNo('40001')).toBe('40001')
    expect(expandAccountNo('60012')).toBe('60012')
  })

  it('handles Devanagari digits and empties', () => {
    expect(expandAccountNo('४१')).toBe('40001')
    expect(expandAccountNo('')).toBe('')
    expect(expandAccountNo('abc')).toBe('')
  })
})

describe('accountDigits', () => {
  it('keeps only Latin digits', () => {
    expect(accountDigits('A-40001')).toBe('40001')
    expect(accountDigits('५०००७')).toBe('50007')
  })
})

describe('accountSearchScore', () => {
  it('requires every query digit to be present', () => {
    expect(accountSearchScore('40001', '51')).toBe(-1)
    expect(accountSearchScore('50001', '51')).toBeGreaterThanOrEqual(0)
    expect(accountSearchScore('50012', '51')).toBeGreaterThanOrEqual(0)
    expect(accountSearchScore('40001', 'ram')).toBe(-1)
  })

  it('ranks prefix > contiguous > ordered > scattered', () => {
    const prefix = accountSearchScore('51000', '51')
    const contiguous = accountSearchScore('40051', '51')
    const ordered = accountSearchScore('50001', '51')
    const scattered = accountSearchScore('15000', '51')
    expect(prefix).toBeGreaterThan(contiguous)
    expect(contiguous).toBeGreaterThan(ordered)
    expect(ordered).toBeGreaterThan(scattered)
  })
})

describe('rankByAccount', () => {
  it('drops non-matches and puts the most relevant first', () => {
    const holders = [
      { accountNo: '40001' },
      { accountNo: '15000' },
      { accountNo: '40051' },
      { accountNo: '51000' },
      { accountNo: '50001' },
    ]
    expect(
      rankByAccount(holders, '51', (holder) => holder.accountNo).map(
        (holder) => holder.accountNo,
      ),
    ).toEqual(['51000', '40051', '50001', '15000'])
  })
})