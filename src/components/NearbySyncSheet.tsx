import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CollectionExport,
  CollectionImportResult,
  Profile,
} from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  collectionMonthDaySummaries,
  parseCollectionExport,
  summarizeCollectionExport,
  type CollectionMonthDaysSummary,
} from '../lib/collectionExport'
import {
  NearbySync,
  isNearbySupported,
  type NearbyEndpoint,
  type NearbyEventMap,
} from '../lib/nearby'
import {
  formatDate,
  formatDigits,
  formatMonth,
  formatRupees,
  todayIso,
} from '../lib/marathi'
import { pushBackHandler } from '../lib/backButton'
import { describeImportResult } from '../lib/importSummary'
import { BottomSheet } from './BottomSheet'
import { DatePicker } from './DatePicker'
import { CheckIcon, DownloadIcon, ShareIcon } from './Icons'

interface NearbySyncSheetProps {
  repo: Repository
  profile: Profile | null
  exportData: CollectionExport | null
  onClose: () => void
  onImported: (result: CollectionImportResult) => void
}

type Mode = 'choose' | 'send' | 'receive'
type Phase =
  | 'idle'
  | 'waiting'
  | 'searching'
  | 'connecting'
  | 'connected'
  | 'sending'
  | 'sent'
  | 'receiving'
  | 'review'
  | 'done'
  | 'error'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function NearbySyncSheet({
  repo,
  profile,
  exportData,
  onClose,
  onImported,
}: NearbySyncSheetProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]

  const [mode, setMode] = useState<Mode>('choose')
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [endpoints, setEndpoints] = useState<NearbyEndpoint[]>([])
  const [pending, setPending] = useState<CollectionExport | null>(null)
  const [imported, setImported] = useState<CollectionImportResult | null>(null)

  const today = todayIso()
  const [rangeStart, setRangeStart] = useState(
    exportData?.range.start || today,
  )
  const [rangeEnd, setRangeEnd] = useState(exportData?.range.end || today)
  const [pickTarget, setPickTarget] = useState<'start' | 'end' | null>(null)
  const [sendData, setSendData] = useState<CollectionExport | null>(exportData)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [rangeError, setRangeError] = useState('')

  const modeRef = useRef<Mode>('choose')
  const dataRef = useRef<CollectionExport | null>(exportData)
  const importedRef = useRef(onImported)
  const onCloseRef = useRef(onClose)
  const pickTargetRef = useRef<'start' | 'end' | null>(null)

  useEffect(() => {
    dataRef.current = sendData
  }, [sendData])

  useEffect(() => {
    importedRef.current = onImported
  }, [onImported])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    pickTargetRef.current = pickTarget
  }, [pickTarget])

  useEffect(() => {
    return pushBackHandler(() => {
      if (pickTargetRef.current) {
        setPickTarget(null)
        return true
      }
      void NearbySync.stop().catch(() => {})
      onCloseRef.current()
      return true
    })
  }, [])

  const deviceName =
    (profile?.societyName || profile?.agentName || 'Collection').slice(0, 40)

  const summary = sendData ? summarizeCollectionExport(sendData) : null
  const outgoingMonths = useMemo(
    () => (sendData ? collectionMonthDaySummaries(sendData) : []),
    [sendData],
  )
  const incomingMonths = useMemo(
    () => (pending ? collectionMonthDaySummaries(pending) : []),
    [pending],
  )
  const supported = isNearbySupported()

  useEffect(() => {
    if (!supported || mode === 'receive') return
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return
    const state = { cancelled: false }
    repo
      .exportCollections(rangeStart, rangeEnd)
      .then((data) => {
        if (state.cancelled) return
        setSendData(data)
      })
      .catch((error) => {
        if (state.cancelled) return
        setSendData(null)
        setRangeError(errorText(error))
      })
      .finally(() => {
        if (!state.cancelled) setRangeLoading(false)
      })
    return () => {
      state.cancelled = true
    }
  }, [repo, supported, mode, rangeStart, rangeEnd])

  function onPickRange(date: string) {
    setRangeError('')
    setRangeLoading(true)
    if (pickTarget === 'start') {
      setRangeStart(date)
      if (date > rangeEnd) setRangeEnd(date)
    } else if (pickTarget === 'end') {
      setRangeEnd(date)
      if (date < rangeStart) setRangeStart(date)
    }
    setPickTarget(null)
  }

  useEffect(() => {
    if (!supported) return
    const state = { disposed: false }
    const handles: { remove: () => Promise<void> }[] = []

    async function register<E extends keyof NearbyEventMap>(
      name: E,
      listener: (event: NearbyEventMap[E]) => void,
    ) {
      const handle = await NearbySync.addListener(name, listener)
      if (state.disposed) {
        void handle.remove()
        return
      }
      handles.push(handle)
    }

    void register('endpointFound', (event) => {
      setEndpoints((prev) =>
        prev.some((item) => item.endpointId === event.endpointId)
          ? prev
          : [...prev, event],
      )
    })

    void register('endpointLost', (event) => {
      setEndpoints((prev) =>
        prev.filter((item) => item.endpointId !== event.endpointId),
      )
    })

    void register('connectionResult', (event) => {
      if (!event.connected) {
        setPhase('error')
        setMessage(event.message || s.nearbyConnecting)
        return
      }
      if (modeRef.current === 'send') {
        const data = dataRef.current
        if (!data) {
          setPhase('error')
          setMessage(s.exportNoData)
          return
        }
        setPhase('sending')
        NearbySync.send({ data: JSON.stringify(data) })
          .then(() => {
            setPhase('sent')
          })
          .catch((error) => {
            setPhase('error')
            setMessage(errorText(error))
          })
      } else {
        setPhase('receiving')
      }
    })

    void register('payloadReceived', (event) => {
      if (modeRef.current !== 'receive') return
      let parsed: CollectionExport
      try {
        parsed = parseCollectionExport(event.data)
      } catch {
        setPhase('error')
        setMessage(s.exportInvalidFile)
        void NearbySync.stop()
        return
      }
      void NearbySync.stop()
      setPending(parsed)
      setImported(null)
      setMessage('')
      setPhase('review')
    })

    void register('disconnected', () => {
      setPhase((prev) =>
        prev === 'done' || prev === 'sent' || prev === 'review'
          ? prev
          : 'idle',
      )
    })

    return () => {
      state.disposed = true
      handles.forEach((handle) => {
        void handle.remove()
      })
      void NearbySync.stop().catch(() => {})
    }
  }, [repo, s, supported])

  async function startSend() {
    if (!sendData || (summary?.rows ?? 0) === 0) {
      setPhase('error')
      setMessage(s.exportNoData)
      return
    }
    modeRef.current = 'send'
    setMode('send')
    setEndpoints([])
    setPending(null)
    setImported(null)
    setMessage('')
    setPhase('waiting')
    try {
      const availability = await NearbySync.isAvailable()
      if (!availability.available) {
        setPhase('error')
        setMessage(s.nearbyUnavailable)
        return
      }
      await NearbySync.startAdvertising({ name: deviceName })
    } catch (error) {
      setPhase('error')
      setMessage(errorText(error))
    }
  }

  async function startReceive() {
    modeRef.current = 'receive'
    setMode('receive')
    setEndpoints([])
    setPending(null)
    setImported(null)
    setMessage('')
    setPhase('searching')
    try {
      const availability = await NearbySync.isAvailable()
      if (!availability.available) {
        setPhase('error')
        setMessage(s.nearbyUnavailable)
        return
      }
      await NearbySync.startDiscovery()
    } catch (error) {
      setPhase('error')
      setMessage(errorText(error))
    }
  }

  async function connectTo(endpoint: NearbyEndpoint) {
    setMessage('')
    setPhase('connecting')
    try {
      await NearbySync.connect({
        endpointId: endpoint.endpointId,
        name: deviceName,
      })
    } catch (error) {
      setPhase('error')
      setMessage(errorText(error))
    }
  }

  async function confirmMerge() {
    if (!pending) return
    setPhase('receiving')
    setMessage('')
    try {
      const result = await repo.importCollections(pending)
      setImported(result)
      setPending(null)
      setPhase('done')
      importedRef.current(result)
    } catch (error) {
      setPhase('error')
      setMessage(errorText(error))
    }
  }

  async function reset() {
    await NearbySync.stop().catch(() => {})
    modeRef.current = 'choose'
    setMode('choose')
    setPhase('idle')
    setMessage('')
    setEndpoints([])
    setPending(null)
    setImported(null)
  }

  function close() {
    void NearbySync.stop().catch(() => {})
    onClose()
  }

  const busy =
    phase === 'waiting' ||
    phase === 'searching' ||
    phase === 'connecting' ||
    phase === 'sending' ||
    phase === 'receiving'

  const statusText =
    phase === 'waiting'
      ? s.nearbyWaiting
      : phase === 'searching'
        ? s.nearbySearching
        : phase === 'connecting'
          ? s.nearbyConnecting
          : phase === 'connected'
            ? s.nearbyConnected
            : phase === 'sending'
              ? s.nearbySending
              : phase === 'sent'
                ? s.nearbySent
                : phase === 'receiving'
                  ? s.nearbyReceiving
                  : ''

  function renderDetails(
    data: CollectionExport,
    months: CollectionMonthDaysSummary[],
  ) {
    const detail = summarizeCollectionExport(data)
    const accounts = new Set(
      data.collections.map((row) => row.accountNo),
    ).size
    return (
      <div className="nearby-details">
        <div className="report-cards">
          <div className="report-card">
            <small>{s.exportDays}</small>
            <b>{formatDigits(detail.days, lang)}</b>
          </div>
          <div className="report-card">
            <small>{s.accounts}</small>
            <b>{formatDigits(accounts, lang)}</b>
          </div>
          <div className="report-card highlight">
            <small>{s.exportTotal}</small>
            <b>{formatRupees(detail.total, lang)}</b>
          </div>
        </div>

        {detail.start && detail.end ? (
          <p className="field-hint">
            {formatDate(detail.start, lang)} – {formatDate(detail.end, lang)}
          </p>
        ) : null}

        {months.map((month) => (
          <div key={month.month} className="nearby-month">
            <div className="nearby-month-head">
              <b>{formatMonth(month.month, lang)}</b>
              <small>
                {formatDigits(month.dayCount, lang)} {s.exportDays} ·{' '}
                {formatRupees(month.total, lang)}
              </small>
            </div>
            <section className="list">
              {month.days.map((day) => (
                <div key={day.date} className="nearby-holder">
                  <div className="who">
                    <b>{formatDate(day.date, lang)}</b>
                  </div>
                  <div className="nearby-holder-amount">
                    <b>{formatRupees(day.total, lang)}</b>
                    <small>
                      {formatDigits(day.accounts, lang)} {s.accounts}
                    </small>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <BottomSheet
        title={s.nearbyTitle}
        closeLabel={s.close}
        onClose={close}
        stickyFooter
        footer={
        phase === 'review' ? (
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void reset()}
            >
              {s.nearbyCancel}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void confirmMerge()}
            >
              <CheckIcon />
              {s.exportImportConfirm}
            </button>
          </>
        ) : (
          <>
            {mode !== 'choose' && phase !== 'done' && phase !== 'sent' ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={phase === 'sending' || phase === 'receiving'}
                onClick={() => void reset()}
              >
                {s.nearbyCancel}
              </button>
            ) : null}
            <button type="button" className="btn-primary" onClick={close}>
              {phase === 'done' || phase === 'sent' ? s.nearbyDone : s.close}
            </button>
          </>
        )
      }
    >
      {!supported ? (
        <p className="form-error">{s.nearbyUnavailable}</p>
      ) : mode === 'choose' ? (
        <>
          <p className="field-hint">{s.nearbySubtitle}</p>

          <div className="form-grid">
            <button
              type="button"
              className="export-date"
              onClick={() => setPickTarget('start')}
            >
              <small>{s.exportFrom}</small>
              <b>{formatDate(rangeStart, lang)}</b>
            </button>
            <button
              type="button"
              className="export-date"
              onClick={() => setPickTarget('end')}
            >
              <small>{s.exportTo}</small>
              <b>{formatDate(rangeEnd, lang)}</b>
            </button>
          </div>

          {rangeLoading ? (
            <div className="list-loading">
              <span className="spinner" />
            </div>
          ) : summary ? (
            <p className="field-hint">
              {formatDigits(summary.rows, lang)} {s.exportRows} ·{' '}
              {formatDigits(summary.days, lang)} {s.exportDays} ·{' '}
              {formatRupees(summary.total, lang)}
            </p>
          ) : null}
          {rangeError ? <p className="form-error">{rangeError}</p> : null}

          <div className="pdf-actions">
            <button
              type="button"
              className="btn-ghost"
              disabled={rangeLoading || !summary || summary.rows === 0}
              onClick={() => void startSend()}
            >
              <ShareIcon />
              {s.nearbySend}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void startReceive()}
            >
              <DownloadIcon />
              {s.nearbyReceive}
            </button>
          </div>
          <p className="field-hint">{s.nearbySendHint}</p>
        </>
      ) : phase === 'review' && pending ? (
        <>
          <p className="form-note">{s.nearbyReview}</p>
          <p className="field-hint">{s.nearbyReviewHint}</p>
          {renderDetails(pending, incomingMonths)}
        </>
      ) : (
        <>
          <p className="field-hint">
            {mode === 'send' ? s.nearbySendHint : s.nearbyReceiveHint}
          </p>

          {phase === 'done' && imported ? (
            <div className="import-preview">
              <p className="form-note">
                {describeImportResult(imported, lang)}
              </p>
            </div>
          ) : statusText ? (
            <div className="import-preview">
              <p className="form-note">
                {busy ? <span className="spinner" /> : null} {statusText}
              </p>
            </div>
          ) : null}

          {mode === 'receive' &&
          (phase === 'searching' ||
            phase === 'connecting' ||
            phase === 'idle') ? (
            endpoints.length === 0 ? (
              <p className="field-hint">{s.nearbyNoDevices}</p>
            ) : (
              <section className="list">
                {endpoints.map((endpoint) => (
                  <div key={endpoint.endpointId} className="nearby-row">
                    <div className="who">
                      <b>{endpoint.endpointName || s.nearbyTitle}</b>
                    </div>
                    <button
                      type="button"
                      className="picker-action"
                      disabled={phase === 'connecting'}
                      onClick={() => void connectTo(endpoint)}
                    >
                      {s.nearbyConnect}
                    </button>
                  </div>
                ))}
              </section>
            )
          ) : null}

          {message ? <p className="form-error">{message}</p> : null}

          {phase === 'error' ? (
            <button
              type="button"
              className="btn-ghost wide"
              onClick={() => void reset()}
            >
              {s.nearbyRestart}
            </button>
          ) : null}

          {mode === 'send' &&
          sendData &&
          (phase === 'waiting' || phase === 'sending') ? (
            <>
              <p className="form-note">{s.nearbyOutgoing}</p>
              {renderDetails(sendData, outgoingMonths)}
            </>
          ) : null}
        </>
      )}
      </BottomSheet>

      {pickTarget ? (
        <DatePicker
          value={pickTarget === 'start' ? rangeStart : rangeEnd}
          max={today}
          onSelect={onPickRange}
          onClose={() => setPickTarget(null)}
        />
      ) : null}
    </>
  )
}