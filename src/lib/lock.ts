// Developer-only master password used to unlock a locked collection day.
// Do not display this value anywhere in the UI.
export const MASTER_PASSWORD = '2408'

export function verifyMasterPassword(input: string): boolean {
  return input.trim() === MASTER_PASSWORD
}
