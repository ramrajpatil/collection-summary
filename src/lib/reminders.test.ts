import { describe, expect, it } from 'vitest'
import type { Holder, Profile } from './models'
import {
  normalizePhone,
  reminderMessage,
  smsUrl,
  whatsappUrl,
} from './reminders'

const profile: Profile = {
  societyName: 'Shri Ganesh Pat Sanstha',
  address: 'Shirol',
  agentName: 'Sachin',
  managerName: 'Manager',
}

const holder: Holder = {
  id: 1,
  name: 'Ramesh Patil',
  accountNo: '007',
  defaultAmount: 100,
  phone: '9876543210',
  active: true,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

describe('normalizePhone', () => {
  it('adds the Indian country code to 10 digit numbers', () => {
    expect(normalizePhone('9876543210')).toBe('919876543210')
    expect(normalizePhone('+91 98765 43210')).toBe('919876543210')
    expect(normalizePhone('09876543210')).toBe('919876543210')
  })

  it('rejects missing or too short numbers', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
  })
})

describe('reminderMessage', () => {
  it('includes the holder, account and amount', () => {
    const message = reminderMessage(profile, 'en', holder, 100)
    expect(message).toContain('Ramesh Patil')
    expect(message).toContain('007')
    expect(message).toContain('₹100')
  })

  it('supports Marathi', () => {
    const message = reminderMessage(profile, 'mr', holder, 100)
    expect(message).toContain('Ramesh Patil')
    expect(message).toContain('खाते')
  })
})

describe('deep links', () => {
  it('encodes the WhatsApp message', () => {
    expect(whatsappUrl('919876543210', 'a b&c')).toBe(
      'https://wa.me/919876543210?text=a%20b%26c',
    )
  })

  it('builds an SMS body link', () => {
    expect(smsUrl('919876543210', 'hi there')).toBe(
      'sms:+919876543210?body=hi%20there',
    )
  })
})