import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'

interface ToastProps {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const offsetY = useRef(0)
  const pointerId = useRef<number | null>(null)

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startY.current = event.clientY
    offsetY.current = 0
    pointerId.current = event.pointerId
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return
    const next = event.clientY - startY.current
    offsetY.current = next
    setDragY(next)
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return
    pointerId.current = null
    setDragging(false)
    if (Math.abs(offsetY.current) > 36) {
      onDismiss()
      return
    }
    offsetY.current = 0
    setDragY(0)
  }

  const opacity = Math.max(0, 1 - Math.abs(dragY) / 100)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="toast-wrap" role="status" aria-live="polite">
      <div
        className={`toast glass${dragging ? ' dragging' : ''}`}
        style={{ transform: `translateY(${dragY}px)`, opacity }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={() => {
          if (Math.abs(offsetY.current) <= 6) onDismiss()
        }}
      >
        <span className="toast-dot" aria-hidden />
        <span className="toast-message">{message}</span>
      </div>
    </div>,
    document.body,
  )
}
