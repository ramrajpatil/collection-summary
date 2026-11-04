function numericAccount(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

/**
 * Sorts account numbers numerically so "999" comes before "1000" and leading
 * zeros compare by value ("01" and "1" are equal, text breaks the tie).
 * Pure numeric accounts come first, followed by any alphanumeric accounts.
 */
export function compareAccountNo(a: string, b: string): number {
  const na = numericAccount(a)
  const nb = numericAccount(b)

  if (na !== null && nb !== null) {
    if (na !== nb) return na - nb
    return a.localeCompare(b)
  }
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b, undefined, { numeric: true })
}