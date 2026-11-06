import { useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { DayData, Holder, Profile } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  formatDate,
  formatDigits,
  formatReceipt,
  formatRupees,
  shiftIsoDate,
  toLatinDigits,
  todayIso,
} from '../lib/marathi'
import { holderName } from '../lib/names'
import { verifyMasterPassword } from '../lib/lock'
import { pushBackHandler } from '../lib/backButton'
import {
  buildDailySheetHtml,
  generateNativePdf,
  openPrintPreview,
  sharePdfToWhatsApp,
  type SheetSort,
} from '../lib/sheets'
import { BottomSheet } from '../components/BottomSheet'
import { DatePicker } from '../components/DatePicker'
import { ScanFlow } from '../components/ScanFlow'
import { Toast } from '../components/Toast'
import {
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  UnlockIcon,
  UsersIcon,
} from '../components/Icons'

interface CollectionScreenProps {
  repo: Repository
  profile: Profile
  onGoToHolders: () => void
}

const QUICK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 1500]

function padReceipt(value: number | string): string {
  const digits = String(value).replace(/\D/g, '')
  return digits ? digits.padStart(4, '0') : ''
}

interface AmountTarget {
  holder: Holder
  amount: number
  collected: boolean
}

export function CollectionScreen({
  repo,
  profile,
  onGoToHolders,
}: CollectionScreenProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]
  const today = todayIso()

  const [date, setDate] = useState(today)
  const [day, setDay] = useState<DayData | null>(null)
  const [holders, setHolders] = useState<Holder[]>([])
  const [loading, setLoading] = useState(true)
  const [holdersLoading, setHoldersLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [startDraft, setStartDraft] = useState('0001')
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null)
  const [amountError, setAmountError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'collected' | 'pending'>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfSort, setPdfSort] = useState<SheetSort>('account')
  const [pdfAction, setPdfAction] = useState<'save' | 'share' | null>(null)

  const refresh = () => setReloadToken((token) => token + 1)
  const isToday = date === today
  const locked = day?.locked ?? false

  function changeDate(next: string) {
    if (!next || next === date) return
    if (next > today) {
      setStatus(s.futureDate)
      return
    }
    setLoading(true)
    setDate(next)
  }

  function shiftDay(delta: number) {
    changeDate(shiftIsoDate(date, delta))
  }

  useEffect(() => {
    const state = { cancelled: false }
    repo
      .listHolders({ status: 'active', sort: 'account' })
      .then((nextHolders) => {
        if (!state.cancelled) setHolders(nextHolders)
      })
      .catch((err) => {
        if (!state.cancelled) {
          setStatus(
            `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })
      .finally(() => {
        if (!state.cancelled) setHoldersLoading(false)
      })
    return () => {
      state.cancelled = true
    }
  }, [repo, s.failed])

  useEffect(() => {
    const state = { cancelled: false }
    repo
      .getDay(date)
      .then((nextDay) => {
        if (state.cancelled) return
        setDay(nextDay)
        setStartDraft(padReceipt(nextDay.startReceipt))
      })
      .catch((err) => {
        if (!state.cancelled) {
          setStatus(
            `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })
      .finally(() => {
        if (!state.cancelled) setLoading(false)
      })
    return () => {
      state.cancelled = true
    }
  }, [repo, date, reloadToken, s.failed])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (
      !amountTarget &&
      !calendarOpen &&
      !filterOpen &&
      !unlockOpen &&
      !lockConfirmOpen
    )
      return
    return pushBackHandler(() => {
      if (unlockOpen) {
        setUnlockOpen(false)
        return true
      }
      if (lockConfirmOpen) {
        setLockConfirmOpen(false)
        return true
      }
      if (filterOpen) {
        setFilterOpen(false)
        return true
      }
      if (amountTarget) {
        setAmountTarget(null)
        setAmountError('')
        return true
      }
      setCalendarOpen(false)
      return true
    })
  }, [amountTarget, calendarOpen, filterOpen, unlockOpen, lockConfirmOpen])

  const entryByHolder = useMemo(() => {
    const map = new Map<number, DayData['entries'][number]>()
    day?.entries.forEach((entry) => map.set(entry.holderId, entry))
    return map
  }, [day])

  const collectedHolderIds = useMemo(
    () => day?.entries.map((entry) => entry.holderId) ?? [],
    [day],
  )

  const existingReceipts = useMemo(
    () => day?.entries.map((entry) => entry.receiptNo) ?? [],
    [day],
  )

  const nextReceipt = useMemo(() => {
    const start = day?.startReceipt ?? 1
    const highest =
      day?.entries.reduce(
        (value, entry) => Math.max(value, entry.receiptNo),
        start - 1,
      ) ?? start - 1
    return highest + 1
  }, [day])

  const total = day?.entries.reduce((sum, entry) => sum + entry.amount, 0) ?? 0
  const collectedCount = day?.entries.length ?? 0
  const pendingCount = holders.length - collectedCount

  const visibleHolders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return holders.filter((holder) => {
      const entry = entryByHolder.get(holder.id)
      if (filter === 'collected' && !entry) return false
      if (filter === 'pending' && entry) return false
      if (query) {
        const haystack =
          `${holder.name} ${holder.nameEn} ${holder.accountNo}`.toLocaleLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [holders, entryByHolder, search, filter])

  async function toggle(holder: Holder) {
    if (busy) return
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    setBusy(true)
    setStatus('')
    try {
      if (entryByHolder.has(holder.id)) {
        await repo.deleteCollection(holder.id, date)
      } else {
        await repo.saveCollection(holder.id, date, holder.defaultAmount)
      }
      refresh()
    } catch (err) {
      setStatus(
        `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function commitStart(value: number) {
    if (!day) return
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    const next = Math.floor(Number(value))
    if (!Number.isFinite(next) || next < 1) {
      setStartDraft(padReceipt(day.startReceipt))
      return
    }
    if (next === day.startReceipt) {
      setStartDraft(padReceipt(next))
      return
    }
    setBusy(true)
    setStatus('')
    try {
      await repo.setStartReceipt(date, next)
      refresh()
    } catch (err) {
      setStatus(
        `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  function openAmount(holder: Holder) {
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    const entry = entryByHolder.get(holder.id)
    setAmountError('')
    setAmountTarget({
      holder,
      amount: entry?.amount ?? holder.defaultAmount,
      collected: Boolean(entry),
    })
  }

  async function saveAmount() {
    if (!amountTarget) return
    if (locked) {
      setAmountError(s.dayLockedError)
      return
    }
    const amount = Number(amountTarget.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      setAmountError(s.amountInvalid)
      return
    }
    setBusy(true)
    try {
      await repo.saveCollection(amountTarget.holder.id, date, amount)
      setAmountTarget(null)
      setStatus(s.amountSaved)
      refresh()
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function removeAmount() {
    if (!amountTarget) return
    if (locked) {
      setAmountError(s.dayLockedError)
      return
    }
    setBusy(true)
    try {
      await repo.deleteCollection(amountTarget.holder.id, date)
      setAmountTarget(null)
      setStatus(s.amountSaved)
      refresh()
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function openLockConfirm() {
    setLockConfirmOpen(true)
  }

  async function confirmLockDay() {
    if (busy || locked) return
    setBusy(true)
    setStatus('')
    try {
      await repo.setDayLocked(date, true)
      setLockConfirmOpen(false)
      setStatus(s.dayLocked)
      refresh()
    } catch (err) {
      setStatus(
        `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  function openUnlock() {
    setUnlockPassword('')
    setUnlockError('')
    setUnlockOpen(true)
  }

  async function submitUnlock() {
    if (busy) return
    if (!verifyMasterPassword(unlockPassword)) {
      setUnlockError(s.unlockWrong)
      return
    }
    setBusy(true)
    setUnlockError('')
    try {
      await repo.setDayLocked(date, false)
      setUnlockOpen(false)
      setUnlockPassword('')
      setStatus(s.dayUnlocked)
      refresh()
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePdf(sort: SheetSort, action: 'save' | 'share') {
    if (busy) return
    if (!day || day.entries.length === 0) {
      setStatus(s.noEntries)
      return
    }
    setBusy(true)
    setPdfAction(action)
    setStatus('')
    try {
      const html = await buildDailySheetHtml(repo, profile, date, lang, sort)
      if (!html) {
        setStatus(s.noEntries)
        return
      }
      if (!Capacitor.isNativePlatform()) {
        setStatus(
          openPrintPreview(html)
            ? lang === 'mr'
              ? 'वेब प्रिव्ह्यू उघडला.'
              : 'Web preview opened.'
            : s.pdfFailed,
        )
        return
      }
      const fileName = `collection-${date}.pdf`
      const result = await generateNativePdf(html, fileName, action === 'save')
      if (action === 'share') {
        await sharePdfToWhatsApp(result, fileName, s.shareText)
        setStatus(s.pdfSaved)
      } else {
        setStatus(
          `${s.pdfSaved} ${result.path} (${Math.round(result.size / 1024)} KB)`,
        )
      }
      setPdfOpen(false)
    } catch (err) {
      setStatus(
        `${s.pdfFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
      setPdfAction(null)
    }
  }

  if (loading || holdersLoading) {
    return (
      <div className="screen-loading">
        <span className="spinner large" />
        <p>{s.loading}</p>
      </div>
    )
  }

  return (
    <>
      <section className="hero glass">
        <div className="hero-head">
          <div>
            <h1>{isToday ? s.todayCollection : s.pastCollection}</h1>
            <p>{locked ? s.lockedNote : s.tapToCollect}</p>
          </div>
          <button
            type="button"
            className={`icon-btn day-lock${locked ? ' locked' : ''}`}
            aria-label={locked ? s.unlockDay : s.lockDay}
            title={locked ? s.unlockDay : s.lockDay}
            disabled={busy}
            onClick={locked ? openUnlock : openLockConfirm}
          >
            {locked ? <UnlockIcon /> : <LockIcon />}
          </button>
        </div>
        {locked ? <p className="lock-note">{s.lockedBadge}</p> : null}

        <div className="date-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label={s.previousDay}
            onClick={() => shiftDay(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="date-center"
            aria-label={s.selectDate}
            onClick={() => setCalendarOpen(true)}
          >
            <small>{s.dateLabel}</small>
            <b>{formatDate(date, lang)}</b>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={s.nextDay}
            disabled={date >= today}
            onClick={() => shiftDay(1)}
          >
            <ChevronRightIcon />
          </button>
          <button
            type="button"
            className="icon-btn scan-open"
            aria-label={s.scanEntries}
            disabled={busy || locked}
            onClick={() => setScanOpen(true)}
          >
            <CameraIcon />
          </button>
        </div>

        {!isToday ? (
          <button
            type="button"
            className="btn-ghost compact centered date-today"
            onClick={() => changeDate(today)}
          >
            {s.goToday}
          </button>
        ) : null}

        <div className="hero-meta">
          <div className="receipt-start">
            <label htmlFor="startReceipt">{s.startingReceipt}</label>
            <div className="stepper">
              <button
                type="button"
                aria-label={s.startingReceipt}
                disabled={busy || locked}
                onClick={() =>
                  void commitStart(
                    (Number(startDraft) || day?.startReceipt || 1) - 1,
                  )
                }
              >
                <MinusIcon />
              </button>
              <input
                id="startReceipt"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={formatDigits(startDraft, lang)}
                disabled={busy || locked}
                onChange={(event) =>
                  setStartDraft(
                    toLatinDigits(event.target.value)
                      .replace(/\D/g, '')
                      .slice(0, 4),
                  )
                }
                onBlur={() => void commitStart(Number(startDraft))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
              />
              <button
                type="button"
                aria-label={s.startingReceipt}
                disabled={busy || locked}
                onClick={() =>
                  void commitStart(
                    (Number(startDraft) || day?.startReceipt || 1) + 1,
                  )
                }
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <small>{s.totalAccounts}</small>
            <b>{formatDigits(holders.length, lang)}</b>
          </div>
          <div className="stat">
            <small>{s.collected}</small>
            <b>
              {formatDigits(collectedCount, lang)} /{' '}
              {formatDigits(holders.length, lang)}
            </b>
          </div>
          <div className="stat">
            <small>{s.uncollected}</small>
            <b>{formatDigits(pendingCount, lang)}</b>
          </div>
          <div className="stat">
            <small>{isToday ? s.todayAmount : s.dayAmount}</small>
            <b>{formatRupees(total, lang)}</b>
          </div>
        </div>
      </section>

      {holders.length === 0 ? (
        <div className="empty glass">
          <UsersIcon />
          <h2>{s.collectionEmpty}</h2>
          <p>{s.collectionEmptyHint}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={onGoToHolders}
          >
            {s.goToHolders}
          </button>
        </div>
      ) : (
        <>
          <div className="search-filter-row">
            <div className="searchbar glass">
              <SearchIcon />
              <input
                type="search"
                value={search}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={s.searchCollection}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="filter-dropdown-wrapper">
              <button
                type="button"
                className="filter-select glass"
                aria-label={s.filterLabel}
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((prev) => !prev)}
              >
                <span>
                  {filter === 'collected'
                    ? s.filterCollected
                    : filter === 'pending'
                      ? s.filterPending
                      : s.filterAll}
                </span>
                <ChevronRightIcon
                  className={`filter-chevron${filterOpen ? ' open' : ''}`}
                />
              </button>
              {filterOpen ? (
                <>
                  <div
                    className="dropdown-backdrop"
                    onClick={() => setFilterOpen(false)}
                  />
                  <div className="dropdown-menu glass" role="menu">
                    {(
                      [
                        { id: 'all', label: s.filterAll },
                        { id: 'pending', label: s.filterPending },
                        { id: 'collected', label: s.filterCollected },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="menuitem"
                        className={`dropdown-item${filter === opt.id ? ' active' : ''}`}
                        onClick={() => {
                          setFilter(opt.id)
                          setFilterOpen(false)
                        }}
                      >
                        <span>{opt.label}</span>
                        {filter === opt.id ? (
                          <CheckIcon className="dropdown-check" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="list-head" aria-hidden>
            <span className="c">{s.srNo}</span>
            <span>{s.name}</span>
            <span className="c">{s.receiptShort}</span>
            <span className="r list-amount-head">
              <span>{s.amount}</span>
              <span className="list-count">
                {formatDigits(visibleHolders.length, lang)}
              </span>
            </span>
            <span />
          </div>

          {visibleHolders.length === 0 ? (
            <div className="empty glass compact">
              <p>{s.noData}</p>
            </div>
          ) : null}

          <section className="list">
            {visibleHolders.map((holder, index) => {
              const entry = entryByHolder.get(holder.id)
              const isDone = Boolean(entry)
              return (
                <div
                  key={holder.id}
                  className={`row${isDone ? ' done' : ''}`}
                  style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
                >
                  <div className="sr">{formatDigits(index + 1, lang)}</div>
                  <div className="who">
                    <b>{holderName(holder.name, holder.nameEn, lang)}</b>
                    <small>
                      {s.accountNoShort}{' '}
                      {formatDigits(holder.accountNo, lang)}
                    </small>
                  </div>
                  <div className={`receipt${isDone ? ' filled' : ''}`}>
                    {entry ? formatReceipt(entry.receiptNo, lang) : '—'}
                  </div>
                  <button
                    type="button"
                    className={`amount amount-btn${isDone ? ' filled' : ''}`}
                    aria-label={s.editAmount}
                    disabled={locked}
                    onClick={() => openAmount(holder)}
                  >
                    {formatRupees(
                      entry ? entry.amount : holder.defaultAmount,
                      lang,
                    )}
                  </button>
                  <button
                    type="button"
                    className={`collect${isDone ? ' done' : ''}`}
                    aria-label={
                      isDone ? s.unmarkCollected : s.markCollected
                    }
                    disabled={busy || locked}
                    onClick={() => void toggle(holder)}
                  >
                    {isDone ? <CheckIcon /> : <PlusIcon />}
                  </button>
                </div>
              )
            })}
          </section>
        </>
      )}

      <div className="dock glass">
        <div className="dock-total">
          <small>{s.totalCollection}</small>
          <b>{formatRupees(total, lang)}</b>
        </div>
        <div className="dock-actions">
          <button
            type="button"
            className="btn-primary"
            aria-label={s.sharePdf}
            disabled={busy || collectedCount === 0}
            onClick={() => setPdfOpen(true)}
          >
            <ShareIcon />
            {s.sharePdf}
          </button>
        </div>
      </div>

      {pdfOpen ? (
        <BottomSheet
          title={s.sharePdf}
          closeLabel={s.close}
          onClose={() => {
            if (!busy) setPdfOpen(false)
          }}
        >
          <div className="field">
            <span className="field-label">{s.sortPdfBy}</span>
            <div className="segmented" role="group" aria-label={s.sortPdfBy}>
              <button
                type="button"
                className={pdfSort === 'account' ? 'active' : ''}
                disabled={busy}
                onClick={() => setPdfSort('account')}
              >
                {s.sortAccount}
              </button>
              <button
                type="button"
                className={pdfSort === 'receipt' ? 'active' : ''}
                disabled={busy}
                onClick={() => setPdfSort('receipt')}
              >
                {s.sortReceipt}
              </button>
            </div>
          </div>

          <div className="pdf-actions">
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => void handlePdf(pdfSort, 'save')}
            >
              {pdfAction === 'save' ? (
                <span className="spinner" />
              ) : (
                <DownloadIcon />
              )}
              {s.saveToDownloads}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void handlePdf(pdfSort, 'share')}
            >
              {pdfAction === 'share' ? (
                <span className="spinner" />
              ) : (
                <ShareIcon />
              )}
              {s.shareToWhatsApp}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {status ? (
        <Toast
          key={status}
          message={status}
          onDismiss={() => setStatus('')}
          dismissLabel={s.close}
        />
      ) : null}

      {amountTarget ? (
        <BottomSheet
          title={s.editAmount}
          closeLabel={s.close}
          onClose={() => setAmountTarget(null)}
        >
          <div className="amount-holder">
            <b>
              {holderName(amountTarget.holder.name, amountTarget.holder.nameEn, lang)}
            </b>
            <small>
              {s.accountNoShort}{' '}
              {formatDigits(amountTarget.holder.accountNo, lang)}
            </small>
          </div>

          <div className="field">
            <label htmlFor="collectionAmount">{s.amount}</label>
            <input
              id="collectionAmount"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              autoComplete="off"
              value={amountTarget.amount}
              onChange={(event) =>
                setAmountTarget({
                  ...amountTarget,
                  amount: Number(event.target.value),
                })
              }
            />
          </div>

          <div className="field">
            <span className="field-label">{s.quickAmounts}</span>
            <div className="quick-chips">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    amountTarget.amount === value ? 'active' : ''
                  }
                  onClick={() =>
                    setAmountTarget({ ...amountTarget, amount: value })
                  }
                >
                  {formatRupees(value, lang)}
                </button>
              ))}
            </div>
          </div>

          {amountError ? <p className="form-error">{amountError}</p> : null}

          <div className="amount-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void saveAmount()}
            >
              {busy ? <span className="spinner" /> : null}
              {amountTarget.collected ? s.save : s.collectNow}
            </button>
            {amountTarget.collected ? (
              <button
                type="button"
                className="btn-danger-text"
                disabled={busy}
                onClick={() => void removeAmount()}
              >
                {s.removeCollection}
              </button>
            ) : null}
          </div>
        </BottomSheet>
      ) : null}

      {lockConfirmOpen ? (
        <BottomSheet
          title={s.lockDay}
          closeLabel={s.close}
          onClose={() => setLockConfirmOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => setLockConfirmOpen(false)}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void confirmLockDay()}
              >
                {busy ? <span className="spinner" /> : <LockIcon />}
                {s.lockDay}
              </button>
            </>
          }
        >
          <p className="field-hint">{s.lockConfirm}</p>
        </BottomSheet>
      ) : null}

      {unlockOpen ? (
        <BottomSheet
          title={s.unlockDay}
          closeLabel={s.close}
          onClose={() => setUnlockOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => setUnlockOpen(false)}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void submitUnlock()}
              >
                {busy ? <span className="spinner" /> : null}
                {s.unlock}
              </button>
            </>
          }
        >
          <p className="field-hint">{s.unlockHint}</p>
          <div className="field">
            <label htmlFor="unlockPassword">{s.masterPassword}</label>
            <input
              id="unlockPassword"
              type="password"
              value={unlockPassword}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setUnlockPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitUnlock()
              }}
            />
          </div>
          {unlockError ? (
            <p className="form-error">{unlockError}</p>
          ) : null}
        </BottomSheet>
      ) : null}

      {calendarOpen ? (
        <DatePicker
          value={date}
          max={today}
          onSelect={(next) => changeDate(next)}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}

      {scanOpen ? (
        <ScanFlow
          repo={repo}
          date={date}
          lang={lang}
startReceipt={nextReceipt}
            collectedHolderIds={collectedHolderIds}
            existingReceipts={existingReceipts}
            existingEntries={day?.entries ?? []}
            onClose={() => setScanOpen(false)}
          onSaved={(count) => {
            setScanOpen(false)
            refresh()
            setStatus(
              `${formatDigits(count, lang)} ${s.scanSaved}`,
            )
          }}
        />
      ) : null}
    </>
  )
}
