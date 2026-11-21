import sanscript from '@indic-transliteration/sanscript'
import { transliterate } from 'marathi-transliterate'
import type { Lang } from './i18n'

const DEVANAGARI = /[\u0900-\u097F]/
const IAST_CONSONANTS = 'bcdfghjklmnpqrstvwxyzśṣṇṭḍñṅṛḷ'

export function upperName(value: string): string {
  return value.toUpperCase()
}

export function isDevanagari(value: string): boolean {
  return DEVANAGARI.test(value)
}

export function toMarathiName(value: string): string {
  if (!value.trim() || isDevanagari(value)) return value
  return transliterate(value)
}

export function toEnglishName(value: string): string {
  if (!value.trim() || !isDevanagari(value)) return upperName(value)
  const iast = sanscript.t(value, 'devanagari', 'iast')
  return romanizeIast(iast).toUpperCase()
}

function romanizeIast(iast: string): string {
  const schwa = new RegExp(`([${IAST_CONSONANTS}])a\\b`, 'g')
  return iast
    .replace(schwa, '$1')
    .replace(/jñ/g, 'dny')
    .replace(/ā/g, 'a')
    .replace(/ī/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/ṛ/g, 'ri')
    .replace(/ṝ/g, 'ri')
    .replace(/ḷ/g, 'l')
    .replace(/ṃ/g, 'n')
    .replace(/ṁ/g, 'n')
    .replace(/ḥ/g, 'h')
    .replace(/ñ/g, 'ny')
    .replace(/ṅ/g, 'ng')
    .replace(/ṭ/g, 't')
    .replace(/ḍ/g, 'd')
    .replace(/ṇ/g, 'n')
    .replace(/ś/g, 'sh')
    .replace(/ṣ/g, 'sh')
    .replace(/ē/g, 'e')
    .replace(/ō/g, 'o')
}

export function holderName(
  name: string,
  nameEn: string | null | undefined,
  lang: Lang,
): string {
  if (lang === 'en') {
    const english = nameEn?.trim()
    return english ? english : name
  }
  return name
}

/**
 * Adds the honorific used on the signed sheet to the manager's name
 * (e.g. "सौ" in Marathi) unless it is already present.
 */
export function honorificName(name: string, lang: Lang): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  if (lang === 'mr') {
    if (trimmed.startsWith('सौ')) return trimmed
    return `सौ. ${trimmed}`
  }
  if (/^(mrs|mr|ms|smt)\.?\b/i.test(trimmed)) return trimmed
  return `Mrs. ${trimmed}`
}
