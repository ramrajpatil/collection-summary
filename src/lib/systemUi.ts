import { registerPlugin } from '@capacitor/core'

interface SystemUiPlugin {
  setTheme(options: { background: string; light: boolean }): Promise<void>
}

const SystemUi = registerPlugin<SystemUiPlugin>('SystemUi')

export function applySystemTheme(theme: 'dark' | 'light'): void {
  const dark = theme === 'dark'
  void SystemUi.setTheme({
    background: dark ? '#04050a' : '#eef1f8',
    light: !dark,
  }).catch(() => {})
}
