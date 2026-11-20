declare module 'marathi-transliterate' {
  export function transliterate(text: string): string
  export function transliterateWord(word: string): string
  export function getSuggestions(word: string, options?: unknown): string[]
}
