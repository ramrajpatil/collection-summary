import { registerPlugin } from '@capacitor/core'

export interface SmsSenderPlugin {
  request(): Promise<void>
  send(options: { phone: string; message: string }): Promise<void>
}

export const SmsSender = registerPlugin<SmsSenderPlugin>('SmsSender')