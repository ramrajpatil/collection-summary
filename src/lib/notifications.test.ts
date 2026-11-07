import { describe, expect, it } from 'vitest'
import { buildCollectionMessage } from './notifications'

describe('collection notification message', () => {
  it('uses the requested Marathi structure', () => {
    const message = buildCollectionMessage({
      societyName: 'Test Society',
      amount: 50,
      dateIso: '2026-11-07',
      balance: 750,
      now: new Date(2026, 10, 7, 14, 5),
    })
    const lines = message.split('\n')
    expect(lines[0]).toBe('Test Society')
    expect(lines[1]).toBe('आजची वसुली: ₹ ५०')
    expect(lines[2]).toBe('दिनांक: ०७ नोव्हेंबर २०२६ · वेळ: ०२:०५ PM')
    expect(lines[3]).toBe('आत्तापर्यंत शिल्लक: ₹ ७५०')
    expect(lines[4]).toBe('धन्यवाद.')
  })

  it('formats midnight and noon in 12-hour time', () => {
    const midnight = buildCollectionMessage({
      societyName: 'Test Society',
      amount: 50,
      dateIso: '2026-11-07',
      balance: 750,
      now: new Date(2026, 10, 7, 0, 5),
    })
    expect(midnight.split('\n')[2]).toContain('वेळ: १२:०५ AM')

    const noon = buildCollectionMessage({
      societyName: 'Test Society',
      amount: 50,
      dateIso: '2026-11-07',
      balance: 750,
      now: new Date(2026, 10, 7, 12, 5),
    })
    expect(noon.split('\n')[2]).toContain('वेळ: १२:०५ PM')
  })
})