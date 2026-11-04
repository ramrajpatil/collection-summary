import type { Lang } from './i18n'
import type { Profile } from './models'

export type Settings = Profile

const STORAGE_KEY = 'collection-summary.settings'

export function defaultSettings(lang: Lang): Settings {
  return lang === 'mr'
    ? {
        societyName: 'श्री गणेश पतसंस्था मर्या.',
        address: 'मु.पो. शिरोळ, ता. शिरोळ, जि. कोल्हापूर',
        agentName: 'सचिन कदम',
        managerName: 'व्यवस्थापक',
      }
    : {
        societyName: 'Shri Ganesh Pat Sanstha',
        address: 'Shirol, Tal. Shirol, Dist. Kolhapur',
        agentName: 'Sachin Kadam',
        managerName: 'Manager',
      }
}

export function loadStoredSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Settings>
    const base = defaultSettings('mr')
    const pick = (value: unknown, fallback: string) =>
      typeof value === 'string' ? value : fallback
    return {
      societyName: pick(parsed.societyName, base.societyName),
      address: pick(parsed.address, base.address),
      agentName: pick(parsed.agentName, base.agentName),
      managerName: pick(parsed.managerName, base.managerName),
    }
  } catch {
    return null
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    void 0
  }
}
