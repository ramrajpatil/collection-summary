import type { Lang } from './i18n'

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

export const MARATHI_MONTHS = [
  'जानेवारी',
  'फेब्रुवारी',
  'मार्च',
  'एप्रिल',
  'मे',
  'जून',
  'जुलै',
  'ऑगस्ट',
  'सप्टेंबर',
  'ऑक्टोबर',
  'नोव्हेंबर',
  'डिसेंबर',
]

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const MARATHI_WEEKDAYS = [
  'रविवार',
  'सोमवार',
  'मंगळवार',
  'बुधवार',
  'गुरुवार',
  'शुक्रवार',
  'शनिवार',
]

const ENGLISH_WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const MARATHI_WEEKDAYS_SHORT = [
  'रवि',
  'सोम',
  'मंगळ',
  'बुध',
  'गुरु',
  'शुक्र',
  'शनि',
]

const ENGLISH_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function toDevanagariDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)])
}

export function toLatinDigits(value: string): string {
  return value.replace(/[०-९]/g, (d) =>
    String(DEVANAGARI_DIGITS.indexOf(d)),
  )
}

export function formatDigits(value: number | string, lang: Lang = 'mr'): string {
  return lang === 'mr' ? toDevanagariDigits(value) : String(value)
}

export function formatNumber(value: number, lang: Lang = 'mr'): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value)
  return lang === 'mr' ? toDevanagariDigits(formatted) : formatted
}

export function formatRupees(value: number, lang: Lang = 'mr'): string {
  return `₹ ${formatNumber(value, lang)}`
}

export function formatReceipt(
  value: number | string,
  lang: Lang = 'mr',
): string {
  const text = String(value).trim()
  const padded = /^\d+$/.test(text) ? text.padStart(4, '0') : text
  return formatDigits(padded, lang)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatDate(isoDate: string, lang: Lang = 'mr'): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  if (lang === 'mr') {
    return `${toDevanagariDigits(pad2(d))} ${MARATHI_MONTHS[m - 1]} ${toDevanagariDigits(y)}`
  }
  return `${pad2(d)} ${ENGLISH_MONTHS[m - 1]} ${y}`
}

export function formatMonth(month: string, lang: Lang = 'mr'): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  const name = lang === 'mr' ? MARATHI_MONTHS[m - 1] : ENGLISH_MONTHS[m - 1]
  return `${name} ${formatDigits(y, lang)}`
}

/**
 * Day of the week for an ISO date. `short` returns the abbreviated name used
 * inside table rows; the default is the full name used in the sheet header.
 */
export function formatWeekday(
  isoDate: string,
  lang: Lang = 'mr',
  short = false,
): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return ''
  const day = new Date(y, m - 1, d).getDay()
  if (lang === 'mr') {
    return (short ? MARATHI_WEEKDAYS_SHORT : MARATHI_WEEKDAYS)[day] ?? ''
  }
  return (short ? ENGLISH_WEEKDAYS_SHORT : ENGLISH_WEEKDAYS)[day] ?? ''
}

export function isSunday(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return false
  return new Date(y, m - 1, d).getDay() === 0
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
