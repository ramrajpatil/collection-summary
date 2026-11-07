import { registerPlugin } from '@capacitor/core'

export interface SmsSenderPlugin {
  check(): Promise<{ state: 'granted' | 'prompt' | 'denied' }>
  request(): Promise<void>
  openSettings(): Promise<void>
  send(options: { phone: string; message: string }): Promise<void>
}

export const SmsSender = registerPlugin<SmsSenderPlugin>('SmsSender')