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

interface BodyLockSnapshot {
  position: string
  top: string
  left: string
  right: string
  width: string
  overflow: string
  scrollY: number
}

let lockCount = 0
let lockSnapshot: BodyLockSnapshot | null = null

function lockBody(): void {
  if (lockCount === 0) {
    const { body } = document
    lockSnapshot = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      scrollY: window.scrollY,
    }
    body.style.position = 'fixed'
    body.style.top = `-${lockSnapshot.scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
  }
  lockCount += 1
}

function unlockBody(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || !lockSnapshot) return
  const { body } = document
  const snapshot = lockSnapshot
  lockSnapshot = null
  body.style.position = snapshot.position
  body.style.top = snapshot.top
  body.style.left = snapshot.left
  body.style.right = snapshot.right
  body.style.width = snapshot.width
  body.style.overflow = snapshot.overflow
  window.scrollTo(0, snapshot.scrollY)
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

  // Freeze the page behind the sheet so bringing up the keyboard cannot scroll
  // the underlying list, then restore the exact scroll position on close.
  useEffect(() => {
    lockBody()
    return () => unlockBody()
  }, [])

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
