import { describe, expect, it } from 'vitest'
import { holderName, upperName } from './names'

describe('upperName', () => {
  it('uppercases latin text and leaves Devanagari unchanged', () => {
    expect(upperName('ramesh patil')).toBe('RAMESH PATIL')
    expect(upperName('रमेश पाटील')).toBe('रमेश पाटील')
  })
})

describe('holderName', () => {
  it('shows the English name in the English UI', () => {
    expect(holderName('रमेश पाटील', 'RAMESH PATIL', 'en')).toBe('RAMESH PATIL')
  })

  it('falls back to the primary name when English is missing', () => {
    expect(holderName('रमेश पाटील', '', 'en')).toBe('रमेश पाटील')
    expect(holderName('रमेश पाटील', null, 'en')).toBe('रमेश पाटील')
  })

  it('always shows the primary name in the Marathi UI', () => {
    expect(holderName('रमेश पाटील', 'RAMESH PATIL', 'mr')).toBe('रमेश पाटील')
  })
})