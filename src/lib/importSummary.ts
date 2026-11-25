import type { CollectionImportResult } from './models'
import { STRINGS, type Lang } from './i18n'
import { formatDigits } from './marathi'

export function describeImportResult(
  result: CollectionImportResult,
  lang: Lang,
): string {
  const s = STRINGS[lang]
  const imported = `${s.exportImported} (${formatDigits(result.imported, lang)})`
  const reasons: string[] = []

  if (result.skippedLocked > 0) {
    reasons.push(
      `${formatDigits(result.skippedLocked, lang)} ${s.exportSkippedLocked}`,
    )
  }
  if (result.skippedUnknown > 0) {
    reasons.push(
      `${formatDigits(result.skippedUnknown, lang)} ${s.exportSkippedUnknown}`,
    )
  }

  if (reasons.length === 0) return imported
  return `${imported} · ${s.exportSkipped} ${formatDigits(
    result.skipped,
    lang,
  )}: ${reasons.join(', ')}`
}