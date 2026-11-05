import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

let lastTap = 0

export function tapFeedback() {
  const now = Date.now()
  if (now - lastTap < 30) return
  lastTap = now
  if (Capacitor.isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  } else if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(8)
  }
}