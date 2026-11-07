import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import type { DayEntry, Holder } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, type Lang } from '../lib/i18n'
import {
  formatDate,
  formatDigits,
  formatReceipt,
  formatRupees,
  toLatinDigits,
} from '../lib/marathi'
import { holderName } from '../lib/names'
import { pushBackHandler } from '../lib/backButton'
import { readTextFile } from '../lib/backup'
import { parseScanImport } from '../lib/scanImport'
import {
  getGeminiKey,
  prepareScannedImage,
  recognizeWithGemini,
} from '../lib/gemini'
import {
  CameraIcon,
  CloseIcon,
  DocIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from './Icons'

interface ScanFlowProps {
  repo: Repository
  date: string
  lang: Lang
  startReceipt: number
  collectedHolderIds: number[]
  existingReceipts: number[]
  existingEntries: DayEntry[]
  onClose: () => void
  onSaved: (count: number) => void
}

interface ScanRow {
  key: string
  accountNo: string
  amount: string
  rawAccountNo: string
  rawAmount: string
}

type RowStatus = 'blank' | 'matched' | 'missing' | 'already' | 'duplicate'

interface ScanRowSource {
  accountNo?: string | number | null
  amount?: string | number | null
}

let rowSequence = 0

function createRow(entry?: ScanRowSource): ScanRow {
  rowSequence += 1
  const accountNo = entry?.accountNo == null ? '' : String(entry.accountNo)
  const amount = entry?.amount == null ? '' : String(entry.amount)
  return {
    key: `scan-${rowSequence}`,
    accountNo,
    amount,
    rawAccountNo: accountNo,
    rawAmount: amount,
  }
}

function accountDigits(value: string): string {
  return toLatinDigits(value).replace(/[^0-9]/g, '')
}

function findHolder(accountNo: string, holders: Holder[]): Holder | null {
  const digits = accountDigits(accountNo)
  if (!digits) return null
  const exact = holders.find(
    (holder) => accountDigits(holder.accountNo) === digits,
  )
  if (exact) return exact
  const numeric = Number(digits)
  if (!Number.isFinite(numeric)) return null
  return (
    holders.find((holder) => {
      const other = accountDigits(holder.accountNo)
      return other !== '' && Number(other) === numeric
    }) ?? null
  )
}

export function ScanFlow({
  repo,
  date,
  lang,
  startReceipt,
  collectedHolderIds,
  existingReceipts,
  existingEntries,
  onClose,
  onSaved,
}: ScanFlowProps) {
  const s = STRINGS[lang]
  const native = Capacitor.isNativePlatform()
  const [keyConfigured] = useState(() => getGeminiKey().length > 0)
  const [holders, setHolders] = useState<Holder[]>([])
  const [phase, setPhase] = useState<'intro' | 'busy' | 'review'>('intro')
  const [busyLabel, setBusyLabel] = useState('')
  const [rows, setRows] = useState<ScanRow[]>([])
  const [startDraft, setStartDraft] = useState(String(startReceipt))
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let active = true
    repo
      .listHolders({ status: 'all', sort: 'account' })
      .then((values) => {
        if (active) setHolders(values)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [repo])

  useEffect(() => {
    return pushBackHandler(() => {
      if (!saving) onClose()
      return true
    })
  }, [onClose, saving])

  const collected = useMemo(
    () => new Set(collectedHolderIds),
    [collectedHolderIds],
  )

  const rowInfos = useMemo(() => {
    const seen = new Set<number>()
    return rows.map((row) => {
      const holder = findHolder(row.accountNo, holders)
      const amount = row.amount.trim() === '' ? null : Number(row.amount)
      const amountValid =
        amount !== null && Number.isFinite(amount) && amount >= 0
      let status: RowStatus
      if (!row.accountNo.trim()) {
        status = 'blank'
      } else if (!holder) {
        status = 'missing'
      } else if (collected.has(holder.id)) {
        status = 'already'
      } else if (seen.has(holder.id)) {
        status = 'duplicate'
      } else {
        seen.add(holder.id)
        status = 'matched'
      }
      return { row, holder, amount, amountValid, status }
    })
  }, [rows, holders, collected])

  const saveable = rowInfos.filter(
    (info) => info.status === 'matched' && info.amountValid,
  )
  const missingCount = rowInfos.filter(
    (info) => info.status === 'missing',
  ).length
  const invalidAmountCount = rowInfos.filter(
    (info) => info.status === 'matched' && !info.amountValid,
  ).length
  const existingReceiptsSet = useMemo(
    () => new Set(existingReceipts),
    [existingReceipts],
  )
  const receiptNumber = Number(startDraft)
  const receiptCollision =
    Number.isInteger(receiptNumber) &&
    receiptNumber >= 1 &&
    saveable.some((_, index) => existingReceiptsSet.has(receiptNumber + index))
  const receiptError =
    startDraft.trim() === '' ||
    !Number.isInteger(receiptNumber) ||
    receiptNumber < 1
      ? s.scanReceiptInvalid
      : receiptCollision
        ? s.scanReceiptUsed
        : ''
  const conflictCount = rowInfos.filter(
    (info) => info.status === 'already' || info.status === 'duplicate',
  ).length
  const conflictAlready = rowInfos.some((info) => info.status === 'already')

  const canSave =
    saveable.length > 0 &&
    missingCount === 0 &&
    invalidAmountCount === 0 &&
    conflictCount === 0 &&
    !receiptError &&
    !saving

  function startManual() {
    setError('')
    if (rows.length === 0) {
      setRows([createRow()])
    }
    setPhase('review')
  }

  function startImport() {
    setError('')
    setNote('')
    fileRef.current?.click()
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return
    setError('')
    setNote('')
    try {
      const text = await readTextFile(file)
      const { entries, skipped } = parseScanImport(text)
      setRows(entries.map((entry) => createRow(entry)))
      if (skipped > 0) {
        setNote(`${s.scanImportSkipped}: ${formatDigits(skipped, lang)}`)
      }
      setPhase('review')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message === 'SCAN_IMPORT_EMPTY' ? s.scanEmpty : s.scanImportInvalid,
      )
    }
  }

  function updateRow(key: string, patch: Partial<ScanRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function addRow() {
    setRows((current) => [...current, createRow()])
  }

  async function runScan() {
    if (phase === 'busy') return
    if (!native) {
      setError(s.scanNativeOnly)
      return
    }
    const apiKey = getGeminiKey()
    if (!apiKey) {
      setError(s.scanNoKey)
      setPhase('intro')
      return
    }
    setError('')
    setPhase('busy')
    setBusyLabel(s.scanPreparing)

    try {
      const photo = await Camera.takePhoto({
        quality: 85,
        editable: 'in-app',
        correctOrientation: true,
        saveToGallery: false,
      })
      const image =
        photo.webPath ?? (photo.uri ? Capacitor.convertFileSrc(photo.uri) : '')
      if (!image) throw new Error(s.scanEmpty)

      setBusyLabel(s.scanReading)
      const base64 = await prepareScannedImage(image)
      const parsed = await recognizeWithGemini(base64, apiKey)

      if (parsed.length === 0) {
        setRows([])
        setError(s.scanEmpty)
        setPhase('review')
        return
      }

      setRows(parsed.map((entry) => createRow(entry)))
      setPhase('review')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/cancel|no picture taken|edit_cancelled/i.test(message)) {
        setPhase(rows.length > 0 ? 'review' : 'intro')
        return
      }
      setError(
        /MISSING_API_KEY/.test(message)
          ? s.scanNoKey
          : /HTTP_|EMPTY_RESPONSE|IMAGE_LOAD_FAILED|IMAGE_PREPARE_TIMEOUT/.test(
                message,
              )
            ? `${s.scanCloudFailed} ${message}`
            : `${s.scanFailed} ${message}`,
      )
      setPhase(rows.length > 0 ? 'review' : 'intro')
    }
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const entries = saveable.map((info, index) => ({
        holderId: info.holder!.id,
        amount: info.amount!,
        receiptNo: receiptNumber + index,
      }))
      if (collectedHolderIds.length === 0) {
        await repo.setStartReceipt(date, receiptNumber)
      }
      await repo.saveCollectionsWithReceipts(date, entries)
      onSaved(entries.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function statusLabel(status: RowStatus): string {
    if (status === 'matched') return s.scanMatched
    if (status === 'missing') return s.scanNotFound
    if (status === 'already') return s.scanAlready
    if (status === 'duplicate') return s.scanDuplicate
    return ''
  }

  return (
    <div className="scan-screen">
      <header className="scan-head">
        <div>
          <h1>{s.scanTitle}</h1>
          <p>{formatDate(date, lang)}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={s.close}
          disabled={saving}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          void handleImportFile(file)
        }}
      />

      <div className="scan-body">
        {phase === 'intro' ? (
          <div className="scan-intro">
            <div className="scan-illustration">
              <CameraIcon />
            </div>
            <p>{s.scanHint}</p>
            {error ? <p className="form-error">{error}</p> : null}
            {!native ? (
              <p className="scan-note">{s.scanNativeOnly}</p>
            ) : !keyConfigured ? (
              <p className="scan-note">{s.scanNoKey}</p>
            ) : null}

            <div className="scan-actions">
              {native && keyConfigured ? (
                <button
                  type="button"
                  className="btn-primary scan-cta"
                  onClick={() => void runScan()}
                >
                  <CameraIcon />
                  {s.scanStart}
                </button>
              ) : null}

              <button
                type="button"
                className={`${
                  native && keyConfigured ? 'btn-ghost' : 'btn-primary'
                } scan-cta`}
                onClick={startManual}
              >
                <EditIcon />
                {s.scanManual}
              </button>

              <button
                type="button"
                className="btn-ghost scan-cta"
                onClick={startImport}
              >
                <DocIcon />
                {s.scanImport}
              </button>
            </div>
          </div>
        ) : null}

        {phase === 'busy' ? (
          <div className="scan-busy">
            <span className="spinner large" />
            <p>{busyLabel}</p>
          </div>
        ) : null}

        {phase === 'review' ? (
          <div className="scan-review">
            {error ? <p className="form-error">{error}</p> : null}
            {note ? <p className="scan-note">{note}</p> : null}
            {rows.length === 0 ? (
              <p className="scan-empty">{s.scanEmpty}</p>
            ) : null}

            <div className="scan-start">
              <label htmlFor="scanStartReceipt">{s.scanReceiptStart}</label>
              <input
                id="scanStartReceipt"
                type="number"
                min={1}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={startDraft}
                onChange={(event) => setStartDraft(event.target.value)}
              />
            </div>
            {receiptError ? (
              <p className="form-error">{receiptError}</p>
            ) : null}

            {existingEntries.length > 0 ? (
              <section className="scan-existing">
                <div className="scan-existing-head">
                  <h2>{s.scanExisting}</h2>
                  <span>{formatDigits(existingEntries.length, lang)}</span>
                </div>
                <div className="scan-existing-list">
                  {existingEntries.map((entry) => (
                    <div
                      className="scan-existing-row"
                      key={entry.collectionId}
                    >
                      <div className="scan-existing-name">
                        <b>{holderName(entry.name, entry.nameEn, lang)}</b>
                        <small>
                          {s.accountNoShort}{' '}
                          {formatDigits(entry.accountNo, lang)}
                        </small>
                      </div>
                      <div className="scan-existing-meta">
                        <b>{formatRupees(entry.amount, lang)}</b>
                        <small>
                          {formatReceipt(entry.receiptNo, lang)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="scan-rows">
              {rowInfos.map((info, index) => (
                <div key={info.row.key} className={`scan-row ${info.status}`}>
                  <div className="scan-row-top">
                    <span className="scan-index">
                      {formatDigits(index + 1, lang)}
                    </span>
                    {info.status !== 'blank' ? (
                      <span className={`scan-chip ${info.status}`}>
                        {statusLabel(info.status)}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn scan-remove"
                      aria-label={s.delete}
                      onClick={() => removeRow(info.row.key)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <div className="scan-fields">
                    <label className="scan-field">
                      <span>{s.accountNoShort}</span>
                      <input
                        value={info.row.accountNo}
                        inputMode="numeric"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) =>
                          updateRow(info.row.key, {
                            accountNo: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="scan-field">
                      <span>{s.amount}</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="decimal"
                        autoComplete="off"
                        value={info.row.amount}
                        onChange={(event) =>
                          updateRow(info.row.key, {
                            amount: event.target.value,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            addRow()
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="scan-row-name">
                    {info.holder ? (
                      <b>
                        {holderName(
                          info.holder.name,
                          info.holder.nameEn,
                          lang,
                        )}
                      </b>
                    ) : info.status === 'blank' ? (
                      <span className="scan-empty-hint">—</span>
                    ) : (
                      <span>{s.scanNotFound}</span>
                    )}
                    {info.row.rawAccountNo &&
                    info.row.rawAccountNo !== info.row.accountNo ? (
                      <small>{info.row.rawAccountNo}</small>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn-ghost wide" onClick={addRow}>
              <PlusIcon />
              {s.scanAdd}
            </button>

            {missingCount > 0 ? (
              <p className="form-error">{s.scanFixUnknown}</p>
            ) : null}
            {invalidAmountCount > 0 ? (
              <p className="form-error">{s.scanFixAmount}</p>
            ) : null}
            {conflictCount > 0 ? (
              <p className="form-error">
                {conflictAlready ? s.scanAlready : s.scanDuplicate}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {phase === 'review' ? (
        <footer className="scan-foot">
          {native && keyConfigured ? (
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={() => void runScan()}
            >
              <CameraIcon />
              {s.scanRetry}
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              disabled={saving}
              onClick={() => setPhase('intro')}
            >
              {s.back}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saving ? <span className="spinner" /> : null}
            {s.scanSave} ({formatDigits(saveable.length, lang)})
          </button>
        </footer>
      ) : null}
    </div>
  )
}