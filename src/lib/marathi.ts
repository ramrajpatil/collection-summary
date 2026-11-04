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

export function toDevanagariDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)])
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
