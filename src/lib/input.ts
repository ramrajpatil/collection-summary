import { toLatinDigits } from './marathi'

/**
 * Keeps only digits. Devanagari digits are converted to Latin first, then
 * every other character is dropped. Use for whole-number fields (receipt
 * numbers, account numbers, quantities).
 */
export function digitsOnly(value: string, maxLength?: number): string {
  const latin = toLatinDigits(value).replace(/[^0-9]/g, '')
  return maxLength === undefined ? latin : latin.slice(0, maxLength)
}

/**
 * Keeps digits and at most one decimal point. Use for money/amount fields so
 * letters, spaces and stray symbols are rejected but decimals still work.
 */
export function decimalOnly(value: string): string {
  const latin = toLatinDigits(value).replace(/[^0-9.]/g, '')
  const firstDot = latin.indexOf('.')
  if (firstDot === -1) return latin
  return latin.slice(0, firstDot + 1) + latin.slice(firstDot + 1).replace(/\./g, '')
}

/**
 * Removes digits (Latin and Devanagari) so name/text fields cannot take
 * numeric input.
 */
export function stripDigits(value: string): string {
  return value.replace(/[0-9०-९]/g, '')
}
