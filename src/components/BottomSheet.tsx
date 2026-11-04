import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface BottomSheetProps {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function BottomSheet({
  title,
  closeLabel,
  onClose,
  children,
  footer,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet glass${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-btn"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
        {footer ? <div className="sheet-actions">{footer}</div> : null}
      </div>
    </div>
  )
}
