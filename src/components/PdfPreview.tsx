import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { STRINGS, useLanguage } from '../lib/i18n'
import { withPreviewStyles, type SheetSort } from '../lib/sheets'
import {
  CloseIcon,
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  ShareIcon,
} from './Icons'

const A4_WIDTH = 794
const A4_HEIGHT = 1123
const MIN_ZOOM = 0.75
const MAX_ZOOM = 5

interface View {
  scale: number
  x: number
  y: number
}

function clampNum(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampView(view: View, width: number, height: number, frameH: number): View {
  const contentW = A4_WIDTH * view.scale
  const contentH = frameH * view.scale
  const x =
    contentW <= width ? (width - contentW) / 2 : clampNum(view.x, width - contentW, 0)
  const y =
    contentH <= height
      ? (height - contentH) / 2
      : clampNum(view.y, height - contentH, 0)
  return { scale: view.scale, x, y }
}

interface PdfPreviewProps {
  html: string
  sort: SheetSort
  receiptsEnabled: boolean
  busy: boolean
  action: 'save' | 'share' | null
  native: boolean
  onSort: (sort: SheetSort) => void
  onAction: (action: 'save' | 'share') => void
  onClose: () => void
}

export function PdfPreview({
  html,
  sort,
  receiptsEnabled,
  busy,
  action,
  native,
  onSort,
  onAction,
  onClose,
}: PdfPreviewProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]
  const srcDoc = useMemo(() => withPreviewStyles(html), [html])

  const bodyRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, fit: 0.46 })
  const frameHeightRef = useRef(A4_HEIGHT)
  const [frameHeight, setFrameHeight] = useState(A4_HEIGHT)
  const [view, setView] = useState<View>({ scale: 0.46, x: 0, y: 0 })

  function zoomAt(cx: number, cy: number, factor: number) {
    const { w, h, fit } = sizeRef.current
    if (w <= 0 || h <= 0) return
    setView((prev) => {
      const base = prev.scale > 0 ? prev.scale : fit
      const next = clampNum(base * factor, fit * MIN_ZOOM, Math.max(fit * MAX_ZOOM, fit))
      const k = next / base
      return clampView(
        {
          scale: next,
          x: cx - (cx - prev.x) * k,
          y: cy - (cy - prev.y) * k,
        },
        w,
        h,
        frameHeightRef.current,
      )
    })
  }

  const zoomAtRef = useRef(zoomAt)

  useEffect(() => {
    zoomAtRef.current = zoomAt
  })

  function resetView() {
    const { w, h, fit } = sizeRef.current
    if (w <= 0) return
    setView(clampView({ scale: fit, x: 0, y: 0 }, w, h, frameHeightRef.current))
  }

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w <= 0 || h <= 0) return
      const fit = Math.min(1, w / A4_WIDTH)
      sizeRef.current = { w, h, fit }
      setView((prev) => {
        const scale =
          prev.scale > 0
            ? clampNum(prev.scale, fit * MIN_ZOOM, Math.max(fit * MAX_ZOOM, fit))
            : fit
        return clampView(
          { scale, x: prev.x, y: prev.y },
          w,
          h,
          frameHeightRef.current,
        )
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAtRef.current(
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function handleFrameLoad() {
    const frame = frameRef.current
    if (!frame) return
    try {
      const doc = frame.contentDocument
      const body = doc?.body
      if (!body) return
      const last = body.lastElementChild as HTMLElement | null
      const bottom = last
        ? last.getBoundingClientRect().bottom
        : body.scrollHeight
      const height = Math.max(A4_HEIGHT, Math.ceil(bottom) + 16)
      frameHeightRef.current = height
      setFrameHeight(height)
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) {
        setView((prev) => clampView(prev, w, h, height))
      }
    } catch {
      void 0
    }
  }

  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const singleRef = useRef<{ x: number; y: number } | null>(null)

  function localPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = overlayRef.current?.getBoundingClientRect()
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = localPoint(event)
    pointersRef.current.set(event.pointerId, point)
    if (pointersRef.current.size === 1) {
      singleRef.current = point
      gestureRef.current = null
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      gestureRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
      singleRef.current = null
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    const point = localPoint(event)
    pointersRef.current.set(event.pointerId, point)
    const { w, h, fit } = sizeRef.current
    if (w <= 0) return

    if (pointersRef.current.size === 1) {
      if (!singleRef.current) {
        singleRef.current = point
        return
      }
      const dx = point.x - singleRef.current.x
      const dy = point.y - singleRef.current.y
      singleRef.current = point
      setView((prev) =>
        clampView(
          { scale: prev.scale || fit, x: prev.x + dx, y: prev.y + dy },
          w,
          h,
          frameHeightRef.current,
        ),
      )
      return
    }

    if (pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const gesture = gestureRef.current
      if (!gesture) {
        gestureRef.current = { dist, cx, cy }
        return
      }
      setView((prev) => {
        const base = prev.scale || fit
        const next = clampNum(
          base * (dist / gesture.dist),
          fit * MIN_ZOOM,
          Math.max(fit * MAX_ZOOM, fit),
        )
        const contentX = (gesture.cx - prev.x) / base
        const contentY = (gesture.cy - prev.y) / base
        return clampView(
          {
            scale: next,
            x: cx - contentX * next,
            y: cy - contentY * next,
          },
          w,
          h,
          frameHeightRef.current,
        )
      })
      gestureRef.current = { dist, cx, cy }
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) gestureRef.current = null
    singleRef.current =
      pointersRef.current.size === 1
        ? [...pointersRef.current.values()][0]
        : null
  }

  return (
    <div className="pdf-preview-screen">
      <header className="pdf-preview-head">
        <h2>{s.pdfPreview}</h2>
        <div className="pdf-preview-tools">
          <button
            type="button"
            className="icon-btn"
            aria-label="−"
            onClick={() => {
              const { w, h } = sizeRef.current
              zoomAt(w / 2, h / 2, 1 / 1.25)
            }}
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="+"
            onClick={() => {
              const { w, h } = sizeRef.current
              zoomAt(w / 2, h / 2, 1.25)
            }}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={s.close}
            disabled={busy}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <div className="pdf-preview-body" ref={bodyRef}>
        <iframe
          ref={frameRef}
          className="pdf-preview-frame"
          title={s.pdfPreview}
          srcDoc={srcDoc}
          onLoad={handleFrameLoad}
          style={{
            width: A4_WIDTH,
            height: frameHeight,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        />
        <div
          ref={overlayRef}
          className="pdf-preview-gesture"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onDoubleClick={resetView}
        />
      </div>

      <footer className="pdf-preview-foot">
        {receiptsEnabled ? (
          <div className="segmented" role="group" aria-label={s.sortPdfBy}>
            <button
              type="button"
              className={sort === 'account' ? 'active' : ''}
              disabled={busy}
              onClick={() => onSort('account')}
            >
              {s.sortAccount}
            </button>
            <button
              type="button"
              className={sort === 'receipt' ? 'active' : ''}
              disabled={busy}
              onClick={() => onSort('receipt')}
            >
              {s.sortReceipt}
            </button>
          </div>
        ) : null}

        <div className="pdf-preview-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onClose}
          >
            {s.cancel}
          </button>
          {native ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => onAction('save')}
            >
              {action === 'save' ? <span className="spinner" /> : <DownloadIcon />}
              {s.save}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => onAction(native ? 'share' : 'save')}
          >
            {action === (native ? 'share' : 'save') ? (
              <span className="spinner" />
            ) : native ? (
              <ShareIcon />
            ) : (
              <PrinterIcon />
            )}
            {native ? s.share : s.printKara}
          </button>
        </div>
      </footer>
    </div>
  )
}