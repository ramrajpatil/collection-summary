import { registerPlugin } from '@capacitor/core'

export interface SmsSenderPlugin {
  send(options: { phone: string; message: string }): Promise<void>
}

export const SmsSender = registerPlugin<SmsSenderPlugin>('SmsSender')