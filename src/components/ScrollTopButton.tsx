import { useEffect, useState } from 'react'
import { STRINGS, useLanguage } from '../lib/i18n'
import { ArrowUpIcon } from './Icons'

interface ScrollTopButtonProps {
  threshold?: number
}

export function ScrollTopButton({ threshold = 420 }: ScrollTopButtonProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function update() {
      const scrollY = window.scrollY
      const remaining =
        document.documentElement.scrollHeight - scrollY - window.innerHeight
      setVisible(scrollY > threshold && remaining > 220)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [threshold])

  if (!visible) return null

  return (
    <button
      type="button"
      className="scroll-top-btn glass"
      aria-label={s.scrollToTop}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUpIcon />
    </button>
  )
}
