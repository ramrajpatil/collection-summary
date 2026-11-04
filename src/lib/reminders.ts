import type { Lang } from './i18n'
import type { Holder, Profile } from './models'
import { holderName } from './names'

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits
}

export function reminderMessage(
  profile: Profile,
  lang: Lang,
  holder: Holder,
  amount: number,
): string {
  const outflow = Math.round(amount)
  const name = holderName(holder.name, holder.nameEn, lang)
  if (lang === 'mr') {
    return (
      `नमस्कार ${name},\n` +
      `${profile.societyName} — खाते क्र. ${holder.accountNo}. ` +
      `आजची ₹${outflow} वसुली बाकी आहे. कृपया वेळेवर भरा.\n` +
      `— ${profile.agentName || profile.societyName}`
    )
  }
  return (
    `Hello ${name},\n` +
    `${profile.societyName} — account no. ${holder.accountNo}. ` +
    `Today's collection of ₹${outflow} is pending. Please pay on time.\n` +
    `— ${profile.agentName || profile.societyName}`
  )
}

export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export function smsUrl(phone: string, message: string): string {
  return `sms:+${phone}?body=${encodeURIComponent(message)}`
}

export function telUrl(phone: string): string {
  return `tel:+${phone}`
}

export function openExternal(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
