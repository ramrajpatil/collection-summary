import { useEffect, useMemo, useState } from 'react'
import type { CollectionExport } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  formatDate,
  formatDigits,
  formatRupees,
  shiftIsoDate,
  todayIso,
} from '../lib/marathi'
import { readTextFile } from '../lib/backup'
import {
  collectionExportCsv,
  collectionExportFileName,
  parseCollectionExport,
  saveCollectionExportFile,
  serializeCollectionExport,
  summarizeCollectionExport,
} from '../lib/collectionExport'
import { commissionPeriod } from '../lib/reports'
import { DatePicker } from '../components/DatePicker'
import {
  ArchiveIcon,
  CopyIcon,
  DocIcon,
  DownloadIcon,
} from '../components/Icons'

interface ExportScreenProps {
  repo: Repository
}

type RangeMode = 'day' | 'week' | 'month' | 'custom'
type PickTarget = 'anchor' | 'start' | 'end'

function weekRange(anchor: string, max: string): { start: string; end: string } {
  const date = new Date(`${anchor}T00:00:00`)
  const offset = (date.getDay() + 6) % 7
  const start = shiftIsoDate(anchor, -offset)
  let end = shiftIsoDate(start, 6)
  if (end > max) end = max
  return { start, end }
}

export function ExportScreen({ repo }: ExportScreenProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]
  const today = todayIso()

  const [mode, setMode] = useState<RangeMode>('day')
  const [anchor, setAnchor] = useState(today)
  const [customStart, setCustomStart] = useState(shiftIsoDate(today, -6))
  const [customEnd, setCustomEnd] = useState(today)
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null)
  const [data, setData] = useState<CollectionExport | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [importData, setImportData] = useState<CollectionExport | null>(null)
  const [importName, setImportName] = useState('')

  const range = useMemo(() => {
    if (mode === 'day') return { start: anchor, end: anchor }
    if (mode === 'week') return weekRange(anchor, today)
    if (mode === 'month') {
      const period = commissionPeriod(anchor.slice(0, 7))
      return {
        start: period.start,
        end: period.end > today ? today : period.end,
      }
    }
    return { start: customStart, end: customEnd }
  }, [mode, anchor, customStart, customEnd, today])

  const valid = Boolean(range.start) && Boolean(range.end) && range.start <= range.end

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    setLoading(true)
    repo
      .exportCollections(range.start, range.end)
      .then((next) => {
        if (cancelled) return
        setData(next)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo, range.start, range.end, valid, reloadToken])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

  const activeData = valid ? data : null
  const summary = useMemo(
    () =>
      activeData
        ? summarizeCollectionExport(activeData)
        : { start: '', end: '', rows: 0, days: 0, total: 0 },
    [activeData],
  )
  const importSummary = useMemo(
    () => (importData ? summarizeCollectionExport(importData) : null),
    [importData],
  )

  const modeOptions: { id: RangeMode; label: string }[] = [
    { id: 'day', label: s.rangeDay },
    { id: 'week', label: s.rangeWeek },
    { id: 'month', label: s.rangeMonth },
    { id: 'custom', label: s.rangeCustom },
  ]

  function onPick(date: string) {
    if (pickTarget === 'start') setCustomStart(date)
    else if (pickTarget === 'end') setCustomEnd(date)
    else setAnchor(date)
    setPickTarget(null)
  }

  async function exportAs(extension: 'json' | 'csv') {
    if (!activeData || busy) return
    if (activeData.collections.length === 0) {
      setStatus(s.exportNoData)
      return
    }
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const fileName = collectionExportFileName(activeData, extension)
      const text =
        extension === 'json'
          ? serializeCollectionExport(activeData)
          : collectionExportCsv(activeData)
      const mimeType =
        extension === 'json' ? 'application/json' : 'text/csv'
      const location = await saveCollectionExportFile(
        fileName,
        text,
        mimeType,
      )
      setStatus(`${s.exportSavedTo} ${location}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    try {
      const raw = await readTextFile(file)
      const parsed = parseCollectionExport(raw)
      setImportData(parsed)
      setImportName(file.name)
      setError('')
    } catch {
      setImportData(null)
      setImportName('')
      setError(s.exportInvalidFile)
    }
  }

  async function runImport() {
    if (!importData || busy) return
    setBusy(true)
    setStatus('')
    setError('')
    try {
      const result = await repo.importCollections(importData)
      setStatus(
        `${s.exportImported} (${formatDigits(result.imported, lang)}${
          result.skipped > 0
            ? `, ${formatDigits(result.skipped, lang)} ${s.exportSkipped}`
            : ''
        })`,
      )
      setImportData(null)
      setImportName('')
      setReloadToken((token) => token + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const pickValue =
    pickTarget === 'start'
      ? customStart
      : pickTarget === 'end'
        ? customEnd
        : anchor

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>{s.exportTitle}</h1>
          <p>{s.exportSubtitle}</p>
        </div>
      </div>

      <div className="field">
        <span className="field-label">{s.exportRange}</span>
        <div className="segmented" role="group" aria-label={s.exportRange}>
          {modeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={mode === option.id ? 'active' : ''}
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'custom' ? (
        <div className="form-grid">
          <button
            type="button"
            className="export-date"
            onClick={() => setPickTarget('start')}
          >
            <small>{s.exportFrom}</small>
            <b>{formatDate(customStart, lang)}</b>
          </button>
          <button
            type="button"
            className="export-date"
            onClick={() => setPickTarget('end')}
          >
            <small>{s.exportTo}</small>
            <b>{formatDate(customEnd, lang)}</b>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="export-date wide"
          onClick={() => setPickTarget('anchor')}
        >
          <small>
            {mode === 'day'
              ? s.rangeDay
              : mode === 'week'
                ? s.rangeWeek
                : s.rangeMonth}
          </small>
          <b>{formatDate(anchor, lang)}</b>
        </button>
      )}

      {valid ? (
        <p className="field-hint">
          {formatDate(range.start, lang)} – {formatDate(range.end, lang)}
        </p>
      ) : (
        <p className="form-error">{s.exportRangeInvalid}</p>
      )}

      <div className="report-cards">
        <div className="report-card">
          <small>{s.exportRows}</small>
          <b>{formatDigits(summary.rows, lang)}</b>
        </div>
        <div className="report-card">
          <small>{s.exportDays}</small>
          <b>{formatDigits(summary.days, lang)}</b>
        </div>
        <div className="report-card highlight">
          <small>{s.exportTotal}</small>
          <b>{formatRupees(summary.total, lang)}</b>
        </div>
      </div>

      {loading ? (
        <div className="list-loading">
          <span className="spinner" />
        </div>
      ) : null}

      <div className="pdf-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || !activeData || summary.rows === 0}
          onClick={() => void exportAs('json')}
        >
          {busy ? <span className="spinner" /> : <ArchiveIcon />}
          {s.exportJson}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !activeData || summary.rows === 0}
          onClick={() => void exportAs('csv')}
        >
          <DocIcon />
          {s.exportCsv}
        </button>
      </div>

      {activeData && summary.rows === 0 && !loading ? (
        <p className="form-note">{s.exportNoData}</p>
      ) : null}

      <div className="backup-section">
        <h3>{s.exportImport}</h3>
        <p className="field-hint">{s.exportImportHint}</p>
        <label className="file-picker">
          <DownloadIcon />
          <span>{s.exportImportChoose}</span>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void pickFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>

        {importData && importSummary ? (
          <div className="import-preview">
            <p className="form-note">
              {s.exportImportPreview}:{' '}
              {formatDigits(importSummary.rows, lang)} ·{' '}
              {formatDate(importSummary.start, lang)} –{' '}
              {formatDate(importSummary.end, lang)}
            </p>
            {importName ? (
              <p className="field-hint">
                <CopyIcon className="action-icon" /> {importName}
              </p>
            ) : null}
            <button
              type="button"
              className="btn-primary wide"
              disabled={busy}
              onClick={() => void runImport()}
            >
              {busy ? <span className="spinner" /> : null}
              {s.exportImportConfirm}
            </button>
          </div>
        ) : null}
      </div>

      {status ? <p className="form-note">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {pickTarget ? (
        <DatePicker
          value={pickValue}
          max={today}
          onSelect={onPick}
          onClose={() => setPickTarget(null)}
        />
      ) : null}
    </>
  )
}
