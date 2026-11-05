import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
import type { Holder } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, type Lang } from '../lib/i18n'
import { formatDate, formatDigits, toLatinDigits } from '../lib/marathi'
import { holderName } from '../lib/names'
import { pushBackHandler } from '../lib/backButton'
import {
  getGeminiKey,
  prepareScannedImage,
  recognizeWithGemini,
  type GeminiEntry,
} from '../lib/gemini'
import { CameraIcon, CloseIcon, PlusIcon, TrashIcon } from './Icons'

interface ScanFlowProps {
  repo: Repository
  date: string
  lang: Lang
  startReceipt: number
  collectedHolderIds: number[]
  existingReceipts: number[]
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

let rowSequence = 0

function createRow(entry?: GeminiEntry): ScanRow {
  rowSequence += 1
  return {
    key: `scan-${rowSequence}`,
    accountNo: entry?.accountNo ?? '',
    amount: entry?.amount == null ? '' : String(entry.amount),
    rawAccountNo: entry ? String(entry.accountNo) : '',
    rawAmount: entry ? String(entry.amount) : '',
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
  const [saving, setSaving] = useState(false)

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
  const canSave =
    saveable.length > 0 &&
    missingCount === 0 &&
    invalidAmountCount === 0 &&
    !receiptError &&
    !saving

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
            ) : keyConfigured ? (
              <button
                type="button"
                className="btn-primary wide"
                onClick={() => void runScan()}
              >
                <CameraIcon />
                {s.scanStart}
              </button>
            ) : (
              <p className="scan-note">{s.scanNoKey}</p>
            )}
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
                  value={startDraft}
                  onChange={(event) => setStartDraft(event.target.value)}
                />
              </div>
              {receiptError ? (
                <p className="form-error">{receiptError}</p>
              ) : null}

              <div className="scan-rows">
                {rowInfos.map((info, index) => (
                  <div
                    key={info.row.key}
                    className={`scan-row ${info.status}`}
                  >
                    <div className="scan-row-top">
                      <span className="scan-index">
                        {formatDigits(index + 1, lang)}
                      </span>
                      <span className={`scan-chip ${info.status}`}>
                        {statusLabel(info.status)}
                      </span>
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
                          value={info.row.amount}
                          onChange={(event) =>
                            updateRow(info.row.key, {
                              amount: event.target.value,
                            })
                          }
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
          </div>
        ) : null}
      </div>

      {phase === 'review' ? (
        <footer className="scan-foot">
          <button
            type="button"
            className="btn-ghost"
            disabled={saving}
            onClick={() => void runScan()}
          >
            {s.scanRetry}
          </button>
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