import { describe, expect, it } from 'vitest'
import { parseGeminiEntries } from './gemini'

describe('parseGeminiEntries', () => {
  it('parses the structured entries', () => {
    expect(
      parseGeminiEntries(
        '{"entries":[{"accountNo":"40027","amount":50},{"accountNo":"60001","amount":100}]}',
      ),
    ).toEqual([
      { accountNo: '40027', amount: 50 },
      { accountNo: '60001', amount: 100 },
    ])
  })

  it('parses JSON wrapped in a code fence', () => {
    expect(
      parseGeminiEntries(
        '```json\n{"entries":[{"accountNo":"057","amount":100}]}\n```',
      ),
    ).toEqual([{ accountNo: '057', amount: 100 }])
  })

  it('normalizes amounts with currency and commas', () => {
    expect(
      parseGeminiEntries(
        '{"entries":[{"accountNo":"40021","amount":"₹ 1,500"}]}',
      ),
    ).toEqual([{ accountNo: '40021', amount: 1500 }])
  })

  it('accepts numeric account values and drops invalid rows', () => {
    expect(
      parseGeminiEntries(
        '{"entries":[{"accountNo":40022,"amount":200},{"amount":50},{"accountNo":"","amount":10}]}',
      ),
    ).toEqual([{ accountNo: '40022', amount: 200 }])
  })

  it('returns an empty list for invalid output', () => {
    expect(parseGeminiEntries('not json')).toEqual([])
    expect(parseGeminiEntries('{"entries":[]}')).toEqual([])
  })
})