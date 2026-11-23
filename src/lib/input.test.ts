import { describe, expect, it } from 'vitest'
import { decimalOnly, digitsOnly, stripDigits } from './input'

describe('digitsOnly', () => {
  it('drops every non-digit character', () => {
    expect(digitsOnly('12a3 b4')).toBe('1234')
    expect(digitsOnly('₹1,000')).toBe('1000')
    expect(digitsOnly('-42')).toBe('42')
  })

  it('converts Devanagari digits to Latin', () => {
    expect(digitsOnly('१२३')).toBe('123')
    expect(digitsOnly('खाते ७')).toBe('7')
  })

  it('honours the max length', () => {
    expect(digitsOnly('123456', 4)).toBe('1234')
    expect(digitsOnly('12', 4)).toBe('12')
  })
})

describe('decimalOnly', () => {
  it('keeps digits and a single decimal point', () => {
    expect(decimalOnly('12.5')).toBe('12.5')
    expect(decimalOnly('1a2.b5')).toBe('12.5')
    expect(decimalOnly('1.2.3')).toBe('1.23')
  })

  it('rejects letters, spaces and symbols', () => {
    expect(decimalOnly('abc')).toBe('')
    expect(decimalOnly('₹ 500')).toBe('500')
    expect(decimalOnly('1 000')).toBe('1000')
  })

  it('converts Devanagari digits', () => {
    expect(decimalOnly('५०.५')).toBe('50.5')
  })
})

describe('stripDigits', () => {
  it('removes Latin and Devanagari digits', () => {
    expect(stripDigits('Ram123')).toBe('Ram')
    expect(stripDigits('नाव ४२')).toBe('नाव ')
  })

  it('leaves letters, spaces and punctuation intact', () => {
    expect(stripDigits('Mr. John Doe')).toBe('Mr. John Doe')
    expect(stripDigits('सौ. कमल')).toBe('सौ. कमल')
  })
})
