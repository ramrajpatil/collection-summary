import type { Lang } from './i18n'

export function upperName(value: string): string {
  return value.toUpperCase()
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