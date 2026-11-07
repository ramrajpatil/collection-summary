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
    expect(lines[2]).toBe('दिनांक: ०७ नोव्हेंबर २०२६ · वेळ: १४:०५')
    expect(lines[3]).toBe('आत्तापर्यंत शिल्लक: ₹ ७५०')
    expect(lines[4]).toBe('धन्यवाद.')
  })
})