import { toLatinDigits } from './marathi'

/** Keeps only Latin digits (Devanagari digits are converted first). */
export function accountDigits(value: string): string {
  return toLatinDigits(value).replace(/[^0-9]/g, '')
}

/**
 * Society account numbers are `series + 00 + seq` (e.g. 40001, 60001).
 * Typing the short form — series digit followed by the 1-2 digit sequence —
 * expands it: "41" -> "40001", "412" -> "40012", "57" -> "50007".
 * Values that are already 4+ digits are treated as full account numbers.
 * Used by the manual-entry account field only.
 */
export function expandAccountNo(value: string): string {
  const digits = accountDigits(value)
  if (!digits) return ''
  if (digits.length >= 4) return digits
  const series = digits.slice(0, 1)
  const seq = digits.slice(1).padStart(2, '0')
  return `${series}00${seq}`
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const char of haystack) {
    if (char === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return i === needle.length
}

/**
 * Relevance score for searching account numbers. Returns -1 when the account
 * does not contain every digit of the query. Higher is more relevant, so that
 * results containing the query as a prefix/contiguous run sort before ones
 * where the digits are scattered.
 *
 * Example (query "51"): 51000 (prefix) > 40051 (contiguous) > 50001/50012
 * (in order) > 15000/40015 (same digits, out of order).
 */
export function accountSearchScore(accountNo: string, query: string): number {
  const q = accountDigits(query)
  if (!q) return -1
  const a = accountDigits(accountNo)
  if (!a) return -1
  for (const digit of new Set(q)) {
    if (!a.includes(digit)) return -1
  }
  if (a === q) return 100
  if (a.startsWith(q)) return 90
  if (a.includes(q)) return 80
  if (isSubsequence(q, a)) return 60
  return 30
}

/**
 * Filters and ranks items by how well their account number matches a numeric
 * query. Non-matching items are dropped; the most relevant come first while
 * preserving the original order for equal scores.
 */
export function rankByAccount<T>(
  items: T[],
  query: string,
  getAccount: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: accountSearchScore(getAccount(item), query),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}