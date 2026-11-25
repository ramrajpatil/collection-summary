import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
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
} from '../lib/marathi'
import { holderName } from '../lib/names'
import { digitsOnly } from '../lib/input'
import { accountDigits, expandAccountNo } from '../lib/accounts'
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
  receiptsEnabled: boolean
  collectedHolderIds: number[]
  existingReceipts: number[]
  existingEntries: DayEntry[]
  onClose: () => void
  onSaved: (count: number) => void
  onRefresh: () => void
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

const MANUAL_ROWS = 1
const EXPAND_DELAY = 2500

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

function createRows(count: number): ScanRow[] {
  return Array.from({ length: count }, () => createRow())
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
  receiptsEnabled,
  collectedHolderIds,
  existingReceipts,
  existingEntries,
  onClose,
  onSaved,
  onRefresh,
}: ScanFlowProps) {
  const s = STRINGS[lang]
  const native = Capacitor.isNativePlatform()
  const [keyConfigured] = useState(() => getGeminiKey().length > 0)
  const [holders, setHolders] = useState<Holder[]>([])
  const [phase, setPhase] = useState<'intro' | 'busy' | 'review'>('intro')
  const [mode, setMode] = useState<'manual' | 'camera' | 'json' | null>(null)
  const [busyLabel, setBusyLabel] = useState('')
  const [rows, setRows] = useState<ScanRow[]>([])
  const [startDraft, setStartDraft] = useState(String(startReceipt))
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [insertAfter, setInsertAfter] = useState<DayEntry | null>(null)
  const [insertAccount, setInsertAccount] = useState('')
  const [insertAmount, setInsertAmount] = useState('')
  const [insertBusy, setInsertBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const accountRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const amountRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const expandTimers = useRef<Map<string, number>>(new Map())

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

  useEffect(() => {
    const timers = expandTimers.current
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const collected = useMemo(
    () => new Set(collectedHolderIds),
    [collectedHolderIds],
  )

  const rowInfos = useMemo(() => {
    const seen = new Set<number>()
    return rows.map((row) => {
      const account =
        mode === 'manual' ? expandAccountNo(row.accountNo) : row.accountNo
      const holder = findHolder(account, holders)
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
  }, [rows, holders, collected, mode])

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
    (!receiptsEnabled || !receiptError) &&
    !saving

  const receiptByKey = useMemo(() => {
    const map = new Map<string, number>()
    if (!receiptsEnabled || !Number.isInteger(receiptNumber) || receiptNumber < 1) {
      return map
    }
    let counter = 0
    for (const info of rowInfos) {
      if (info.status === 'matched' && info.amountValid) {
        map.set(info.row.key, receiptNumber + counter)
        counter += 1
      }
    }
    return map
  }, [rowInfos, receiptsEnabled, receiptNumber])

  const insertHolder = useMemo(() => {
    const raw = insertAccount.trim()
    if (!raw) return null
    const account = mode === 'manual' ? expandAccountNo(raw) : raw
    return findHolder(account, holders)
  }, [insertAccount, holders, mode])

  const insertAmountNo = Number(insertAmount)
  const insertValid =
    insertAfter !== null &&
    insertHolder !== null &&
    !collected.has(insertHolder.id) &&
    insertAmount.trim() !== '' &&
    Number.isFinite(insertAmountNo) &&
    insertAmountNo >= 0

  async function submitInsert() {
    if (!insertAfter || !insertValid || !insertHolder || insertBusy) return
    setInsertBusy(true)
    setError('')
    setNote('')
    try {
      await repo.insertCollectionAtReceipt(
        date,
        insertHolder.id,
        Number(insertAmount),
        insertAfter.receiptNo + 1,
      )
      onRefresh()
      setInsertAfter(null)
      setInsertAccount('')
      setInsertAmount('')
      setNote(s.scanInserted)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message === 'ALREADY_COLLECTED'
          ? s.scanAlready
          : message === 'DAY_LOCKED'
            ? s.dayLockedError
            : message,
      )
    } finally {
      setInsertBusy(false)
    }
  }

  function startManual() {
    setError('')
    setMode('manual')
    if (rows.length === 0) {
      setRows(createRows(MANUAL_ROWS))
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
      setMode('json')
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
    cancelExpand(key)
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function scheduleExpand(key: string) {
    cancelExpand(key)
    const timer = window.setTimeout(() => {
      expandTimers.current.delete(key)
      setRows((current) =>
        current.map((row) => {
          if (row.key !== key) return row
          const expanded = expandAccountNo(row.accountNo)
          return expanded && expanded !== row.accountNo
            ? { ...row, accountNo: expanded }
            : row
        }),
      )
    }, EXPAND_DELAY)
    expandTimers.current.set(key, timer)
  }

  function cancelExpand(key: string) {
    const pending = expandTimers.current.get(key)
    if (pending !== undefined) {
      window.clearTimeout(pending)
      expandTimers.current.delete(key)
    }
  }

  function addRow() {
    setRows((current) => [...current, createRow()])
  }

  function focusNextAccount(key: string) {
    const index = rows.findIndex((row) => row.key === key)
    if (index === -1) return
    const next = rows[index + 1]
    if (next) {
      accountRefs.current.get(next.key)?.focus()
      return
    }
    const row = createRow()
    // Commit the new row synchronously so the input exists within this tap
    // gesture; then focusing it keeps the keypad open on Android.
    flushSync(() => {
      setRows((current) => [...current, row])
    })
    accountRefs.current.get(row.key)?.focus()
  }

  function commitAccount(key: string) {
    cancelExpand(key)
    if (mode !== 'manual') return
    const row = rows.find((candidate) => candidate.key === key)
    if (!row) return
    const expanded = expandAccountNo(row.accountNo)
    if (expanded && expanded !== row.accountNo) {
      updateRow(key, { accountNo: expanded })
    }
  }

  // Enter on the account field advances to the amount field of the same row.
  function handleAccountEnter(key: string) {
    commitAccount(key)
    amountRefs.current.get(key)?.focus()
  }

  // Enter on the amount field saves the row and moves on: spawn/focus the next
  // row's account field (manual) or just add a row (camera/JSON import).
  function handleAmountEnter(key: string) {
    commitAccount(key)
    if (mode === 'manual') {
      focusNextAccount(key)
    } else {
      addRow()
    }
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
    setMode('camera')
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

              <div className="scan-secondary-actions">
                <button
                  type="button"
                  className={
                    native && keyConfigured ? 'btn-ghost' : 'btn-primary'
                  }
                  onClick={startManual}
                >
                  <EditIcon />
                  {s.scanManual}
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={startImport}
                >
                  <DocIcon />
                  {s.scanImport}
                </button>
              </div>
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

            {receiptsEnabled ? (
              <>
                <div className="scan-start">
                  <label htmlFor="scanStartReceipt">
                    {s.scanReceiptStart}
                  </label>
                  <input
                    id="scanStartReceipt"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    spellCheck={false}
                    value={formatDigits(startDraft, lang)}
                    onChange={(event) =>
                      setStartDraft(digitsOnly(event.target.value))
                    }
                  />
                </div>
                {receiptError ? (
                  <p className="form-error">{receiptError}</p>
                ) : null}
              </>
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
                        {receiptsEnabled ? (
                          <small>
                            {formatReceipt(entry.receiptNo, lang)}
                          </small>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="icon-btn scan-existing-insert"
                        aria-label={s.scanInsertBelow}
                        title={s.scanInsertBelow}
                        onClick={() => {
                          setInsertAccount('')
                          setInsertAmount('')
                          setInsertAfter(entry)
                        }}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {insertAfter ? (
              <div className="scan-insert-form">
                <div className="scan-insert-head">
                  <span>{s.scanInsertBelow}</span>
                  {receiptsEnabled ? (
                    <b>
                      {s.receiptNo}:{' '}
                      {formatReceipt(insertAfter.receiptNo + 1, lang)}
                    </b>
                  ) : null}
                </div>
                <div className="scan-insert-grid">
                  <label>
                    <span>{s.accountNoShort}</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={formatDigits(insertAccount, lang)}
                      onChange={(event) =>
                        setInsertAccount(digitsOnly(event.target.value))
                      }
                      onBlur={() => {
                        if (mode !== 'manual') return
                        const expanded = expandAccountNo(insertAccount)
                        if (expanded && expanded !== insertAccount) {
                          setInsertAccount(expanded)
                        }
                      }}
                    />
                  </label>
                  <label>
                    <span>{s.amount}</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={insertAmount}
                      onChange={(event) =>
                        setInsertAmount(digitsOnly(event.target.value))
                      }
                    />
                  </label>
                </div>
                {insertAccount.trim() ? (
                  <p
                    className={`scan-insert-name${
                      insertHolder ? '' : ' missing'
                    }`}
                  >
                    {insertHolder
                      ? holderName(insertHolder.name, insertHolder.nameEn, lang)
                      : s.scanNotFound}
                  </p>
                ) : null}
                <div className="scan-insert-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={insertBusy}
                    onClick={() => setInsertAfter(null)}
                  >
                    {s.cancel}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!insertValid || insertBusy}
                    onClick={() => void submitInsert()}
                  >
                    {insertBusy ? <span className="spinner" /> : null}
                    {s.scanAdd}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="scan-rows">
              {rowInfos.map((info, index) => {
                const assigned = receiptByKey.get(info.row.key)
                return (
                  <div
                    key={info.row.key}
                    className={`scan-row ${info.status}`}
                  >
                    <div className="scan-row-head">
                      <span className="scan-index">
                        {assigned !== undefined
                          ? formatReceipt(assigned, lang)
                          : formatDigits(index + 1, lang)}
                      </span>
                      {info.holder ? (
                        <b className="scan-name">
                          {holderName(
                            info.holder.name,
                            info.holder.nameEn,
                            lang,
                          )}
                        </b>
                      ) : info.status === 'blank' ? null : (
                        <b className="scan-name scan-name-missing">
                          {s.scanNotFound}
                        </b>
                      )}
                      {info.row.rawAccountNo &&
                      info.row.rawAccountNo !== info.row.accountNo ? (
                        <small className="scan-raw">
                          {info.row.rawAccountNo}
                        </small>
                      ) : null}
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
                    <div className="scan-row-main">
                      <input
                        className="scan-account"
                        ref={(el) => {
                          if (el) accountRefs.current.set(info.row.key, el)
                          else accountRefs.current.delete(info.row.key)
                        }}
                        value={formatDigits(info.row.accountNo, lang)}
                        placeholder={s.accountNoShort}
                        inputMode="numeric"
                        enterKeyHint="next"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) => {
                          updateRow(info.row.key, {
                            accountNo: digitsOnly(event.target.value),
                          })
                          if (mode === 'manual') {
                            scheduleExpand(info.row.key)
                          }
                        }}
                        onBlur={() => {
                          cancelExpand(info.row.key)
                          if (mode !== 'manual') return
                          const expanded = expandAccountNo(info.row.accountNo)
                          if (expanded && expanded !== info.row.accountNo) {
                            updateRow(info.row.key, { accountNo: expanded })
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleAccountEnter(info.row.key)
                          }
                        }}
                      />
                      <input
                        className="scan-amount-input"
                        ref={(el) => {
                          if (el) amountRefs.current.set(info.row.key, el)
                          else amountRefs.current.delete(info.row.key)
                        }}
                        value={formatDigits(info.row.amount, lang)}
                        placeholder={s.amount}
                        inputMode="numeric"
                        enterKeyHint="done"
                        pattern="[0-9]*"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        onChange={(event) =>
                          updateRow(info.row.key, {
                            amount: digitsOnly(event.target.value),
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleAmountEnter(info.row.key)
                          }
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              className="btn-ghost scan-add-pill"
              onClick={addRow}
            >
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