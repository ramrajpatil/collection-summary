import type { Holder, Profile } from './models'
import {
  formatDate,
  formatRupees,
  toDevanagariDigits,
} from './marathi'
import { normalizePhone, openExternal, smsUrl, whatsappUrl } from './reminders'

const SMS_KEY = 'collection-summary.notify.sms'
const WHATSAPP_KEY = 'collection-summary.notify.whatsapp'

export interface NotifySettings {
  sms: boolean
  whatsapp: boolean
}

export function loadNotifySettings(): NotifySettings {
  try {
    return {
      sms: localStorage.getItem(SMS_KEY) === '1',
      whatsapp: localStorage.getItem(WHATSAPP_KEY) === '1',
    }
  } catch {
    return { sms: false, whatsapp: false }
  }
}

export function saveNotifySettings(settings: NotifySettings): void {
  try {
    localStorage.setItem(SMS_KEY, settings.sms ? '1' : '0')
    localStorage.setItem(WHATSAPP_KEY, settings.whatsapp ? '1' : '0')
  } catch {
    void 0
  }
}

export function buildCollectionMessage(options: {
  societyName: string
  amount: number
  dateIso: string
  balance: number
  now?: Date
}): string {
  const now = options.now ?? new Date()
  const hours = toDevanagariDigits(String(now.getHours()).padStart(2, '0'))
  const minutes = toDevanagariDigits(String(now.getMinutes()).padStart(2, '0'))
  return [
    options.societyName,
    `आजची वसुली: ${formatRupees(options.amount, 'mr')}`,
    `दिनांक: ${formatDate(options.dateIso, 'mr')} · वेळ: ${hours}:${minutes}`,
    `आत्तापर्यंत शिल्लक: ${formatRupees(options.balance, 'mr')}`,
    'धन्यवाद.',
  ].join('\n')
}

export async function sendCollectionNotifications(options: {
  profile: Profile
  holder: Holder
  amount: number
  dateIso: string
  balance: number
  settings: NotifySettings
}): Promise<void> {
  const phone = normalizePhone(options.holder.phone)
  if (!phone) return
  const message = buildCollectionMessage({
    societyName: options.profile.societyName,
    amount: options.amount,
    dateIso: options.dateIso,
    balance: options.balance,
  })

  // Opening the SMS composer needs no SEND_SMS permission, which keeps the
  // app clear of Play Protect's restricted-SMS policy. The agent taps Send.
  if (options.settings.sms) {
    try {
      openExternal(smsUrl(phone, message))
    } catch {
      void 0
    }
  }

  if (options.settings.whatsapp) {
    try {
      // WhatsApp does not allow silent sending from third-party apps; this
      // opens the chat with the message ready for the agent to send.
      openExternal(whatsappUrl(phone, message))
    } catch {
      void 0
    }
  }
}