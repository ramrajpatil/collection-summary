import { describe, expect, it } from 'vitest'
import { compareAccountNo } from './sort'

function sort(values: string[]): string[] {
  return [...values].sort(compareAccountNo)
}

describe('compareAccountNo', () => {
  it('orders account numbers numerically, not lexicographically', () => {
    expect(sort(['1000', '999', '20', '3'])).toEqual([
      '3',
      '20',
      '999',
      '1000',
    ])
    expect(compareAccountNo('999', '1000')).toBeLessThan(0)
  })

  it('compares leading zeros by value', () => {
    expect(sort(['1', '001', '10'])).toEqual(['001', '1', '10'])
    expect(sort(['010', '9', '002'])).toEqual(['002', '9', '010'])
  })

  it('puts numeric accounts before alphanumeric ones', () => {
    expect(sort(['B-2', '1000', 'A-1', '20'])).toEqual([
      '20',
      '1000',
      'A-1',
      'B-2',
    ])
  })

  it('trims surrounding whitespace', () => {
    expect(sort([' 7 ', '10'])).toEqual([' 7 ', '10'])
  })
})