import { describe, expect, it } from 'vitest'
import { parseScanImport } from './scanImport'

describe('parseScanImport', () => {
  it('parses a list of account/amount objects', () => {
    const result = parseScanImport(
      JSON.stringify([
        { accountNo: '001', amount: 200 },
        { accountNo: '002', amount: '150' },
      ]),
    )
    expect(result.entries).toEqual([
      { accountNo: '001', amount: '200' },
      { accountNo: '002', amount: '150' },
    ])
    expect(result.skipped).toBe(0)
  })

  it('accepts common key aliases', () => {
    const result = parseScanImport(
      JSON.stringify([
        { account_number: '010', rupees: 500 },
        { account: '011', value: '300' },
      ]),
    )
    expect(result.entries).toEqual([
      { accountNo: '010', amount: '500' },
      { accountNo: '011', amount: '300' },
    ])
  })

  it('accepts [account, amount] pairs and entries wrappers', () => {
    expect(
      parseScanImport(JSON.stringify({ entries: [['001', 100]] })).entries,
    ).toEqual([{ accountNo: '001', amount: '100' }])
    expect(parseScanImport(JSON.stringify([['002', 250]])).entries).toEqual([
      { accountNo: '002', amount: '250' },
    ])
  })

  it('accepts an account-to-amount map', () => {
    const result = parseScanImport(JSON.stringify({ '001': 100, '002': '50' }))
    expect(result.entries).toEqual([
      { accountNo: '001', amount: '100' },
      { accountNo: '002', amount: '50' },
    ])
  })

  it('counts unrecognized items as skipped', () => {
    const result = parseScanImport(JSON.stringify([{ accountNo: '001', amount: 10 }, 42]))
    expect(result.entries).toHaveLength(1)
    expect(result.skipped).toBe(1)
  })

  it('rejects invalid JSON and empty lists', () => {
    expect(() => parseScanImport('not json')).toThrow('SCAN_IMPORT_INVALID')
    expect(() => parseScanImport('[]')).toThrow('SCAN_IMPORT_EMPTY')
    expect(() => parseScanImport('{"a": {"b": 1}}')).toThrow(
      'SCAN_IMPORT_INVALID',
    )
  })
})