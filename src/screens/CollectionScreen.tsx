import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { DayData, Holder, Profile } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  formatDate,
  formatDigits,
  formatReceipt,
  formatRupees,
  toLatinDigits,
  todayIso,
} from '../lib/marathi'
import { holderName } from '../lib/names'
import { decimalOnly } from '../lib/input'
import { accountDigits, rankByAccount } from '../lib/accounts'
import { verifyMasterPassword } from '../lib/lock'
import {
  loadNotifySettings,
  sendCollectionNotifications,
} from '../lib/notifications'
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
import { ScrollTopButton } from '../components/ScrollTopButton'
import { Toast } from '../components/Toast'
import {
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  ShareIcon,
  UnlockIcon,
  UsersIcon,
  WalletIcon,
} from '../components/Icons'

interface CollectionScreenProps {
  repo: Repository
  profile: Profile
  receiptsEnabled: boolean
  onGoToHolders: () => void
}

const QUICK_AMOUNTS = [100, 200, 300, 400, 500, 1000, 1500]
const ENTER_ROW_LIMIT = 8

function padReceipt(value: number | string): string {
  const digits = String(value).replace(/\D/g, '')
  return digits ? digits.padStart(4, '0') : ''
}

function renumberEntries(
  entries: DayData['entries'],
  startReceipt: number,
): DayData['entries'] {
  return [...entries]
    .sort(
      (a, b) =>
        a.receiptNo - b.receiptNo || a.collectionId - b.collectionId,
    )
    .map((entry, index) => ({ ...entry, receiptNo: startReceipt + index }))
}

interface AmountTarget {
  holder: Holder
  amount: number
  collected: boolean
}

export function CollectionScreen({
  repo,
  profile,
  receiptsEnabled,
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
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [editPassOpen, setEditPassOpen] = useState(false)
  const [editPassInput, setEditPassInput] = useState('')
  const [editPassError, setEditPassError] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const entryEditUnlocked = useRef(false)
  const pendingEdit = useRef<(() => void) | null>(null)
  const [startDraft, setStartDraft] = useState('0001')
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null)
  const [amountError, setAmountError] = useState('')
  const [reassignFrom, setReassignFrom] = useState<Holder | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignError, setReassignError] = useState('')
  const [reassignSearch, setReassignSearch] = useState('')
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
    entryEditUnlocked.current = false
    setDate(next)
  }

  function closeEditPassword() {
    setEditPassOpen(false)
    setEditPassInput('')
    setEditPassError('')
    setShowEditPassword(false)
    entryEditUnlocked.current = false
    pendingEdit.current = null
  }

  function closeReassign() {
    entryEditUnlocked.current = false
    setReassignOpen(false)
    setReassignFrom(null)
    setReassignError('')
    setReassignSearch('')
  }

  function requestEditPassword(action: () => void) {
    pendingEdit.current = action
    setEditPassInput('')
    setEditPassError('')
    setShowEditPassword(false)
    setEditPassOpen(true)
  }

  function submitEditPassword() {
    if (!verifyMasterPassword(editPassInput)) {
      setEditPassError(s.unlockWrong)
      return
    }
    entryEditUnlocked.current = true
    setEditPassOpen(false)
    setEditPassInput('')
    setShowEditPassword(false)
    const action = pendingEdit.current
    pendingEdit.current = null
    action?.()
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
      !lockConfirmOpen &&
      !editPassOpen &&
      !reassignOpen
    )
      return
    return pushBackHandler(() => {
      if (editPassOpen) {
        closeEditPassword()
        return true
      }
      if (reassignOpen) {
        closeReassign()
        return true
      }
      if (unlockOpen) {
        closeUnlock()
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
        entryEditUnlocked.current = false
        setAmountTarget(null)
        setAmountError('')
        return true
      }
      setCalendarOpen(false)
      return true
    })
  }, [
    amountTarget,
    calendarOpen,
    filterOpen,
    unlockOpen,
    lockConfirmOpen,
    editPassOpen,
    reassignOpen,
  ])

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
  const receiptLocked = collectedCount > 0

  const deferredSearch = useDeferredValue(search)

  const visibleHolders = useMemo(() => {
    const raw = deferredSearch.trim()
    const base = holders.filter((holder) => {
      const entry = entryByHolder.get(holder.id)
      if (filter === 'collected' && !entry) return false
      if (filter === 'pending' && entry) return false
      return true
    })
    if (!raw) return base
    if (accountDigits(raw)) {
      return rankByAccount(base, raw, (holder) => holder.accountNo)
    }
    const query = raw.toLocaleLowerCase()
    return base.filter((holder) =>
      `${holder.name} ${holder.nameEn} ${holder.accountNo}`
        .toLocaleLowerCase()
        .includes(query),
    )
  }, [holders, entryByHolder, deferredSearch, filter])

  const deferredReassignSearch = useDeferredValue(reassignSearch)

  const reassignCandidates = useMemo(() => {
    if (!reassignFrom) return []
    const raw = deferredReassignSearch.trim()
    const base = holders.filter((holder) => {
      if (holder.id === reassignFrom.id) return false
      if (entryByHolder.has(holder.id)) return false
      return true
    })
    if (!raw) return base
    if (accountDigits(raw)) {
      return rankByAccount(base, raw, (holder) => holder.accountNo)
    }
    const query = raw.toLocaleLowerCase()
    return base.filter((holder) =>
      `${holder.name} ${holder.nameEn} ${holder.accountNo}`
        .toLocaleLowerCase()
        .includes(query),
    )
  }, [holders, entryByHolder, reassignFrom, deferredReassignSearch])

  async function notifyCollection(holder: Holder, amount: number) {
    const settings = loadNotifySettings()
    if (!settings.sms && !settings.whatsapp) return
    try {
      const next = await repo.getHolderBalance(holder.id)
      void sendCollectionNotifications({
        profile,
        holder,
        amount,
        dateIso: date,
        balance: next.current,
        settings,
      })
    } catch {
      void 0
    }
  }

  async function toggle(holder: Holder) {
    if (busy) return
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    const existing = entryByHolder.get(holder.id)
    if (existing && !entryEditUnlocked.current) {
      requestEditPassword(() => void toggle(holder))
      return
    }
    const previous = day
    if (day) {
      if (existing) {
        setDay({
          ...day,
          entries: renumberEntries(
            day.entries.filter((entry) => entry.holderId !== holder.id),
            day.startReceipt,
          ),
        })
      } else {
        setDay({
          ...day,
          entries: renumberEntries(
            [
              ...day.entries,
              {
                collectionId: -1,
                holderId: holder.id,
                name: holder.name,
                nameEn: holder.nameEn,
                accountNo: holder.accountNo,
                amount: holder.defaultAmount,
                receiptNo: nextReceipt,
                defaultAmount: holder.defaultAmount,
                createdAt: todayIso(),
              },
            ],
            day.startReceipt,
          ),
        })
      }
    }
    setBusy(true)
    setStatus('')
    try {
      if (existing) {
        await repo.deleteCollection(holder.id, date)
      } else {
        await repo.saveCollection(holder.id, date, holder.defaultAmount)
        void notifyCollection(holder, holder.defaultAmount)
      }
      refresh()
    } catch (err) {
      setDay(previous)
      setStatus(
        `${s.failed}: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      entryEditUnlocked.current = false
      setBusy(false)
    }
  }

  async function commitStart(value: number) {
    if (!day) return
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    if (receiptLocked) return
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
    if (entry && !entryEditUnlocked.current) {
      requestEditPassword(() => openAmount(holder))
      return
    }
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
    if (amountTarget.collected && !entryEditUnlocked.current) {
      requestEditPassword(() => void saveAmount())
      return
    }
    const amount = Number(amountTarget.amount)
    if (!Number.isFinite(amount) || amount < 0) {
      setAmountError(s.amountInvalid)
      return
    }
    const holder = amountTarget.holder
    const updating =
      amountTarget.collected || entryByHolder.has(holder.id)
    const previous = day
    if (day) {
      const entries = updating
        ? day.entries.map((entry) =>
            entry.holderId === holder.id ? { ...entry, amount } : entry,
          )
        : renumberEntries(
            [
              ...day.entries,
              {
                collectionId: -1,
                holderId: holder.id,
                name: holder.name,
                nameEn: holder.nameEn,
                accountNo: holder.accountNo,
                amount,
                receiptNo: nextReceipt,
                defaultAmount: holder.defaultAmount,
                createdAt: todayIso(),
              },
            ],
            day.startReceipt,
          )
      setDay({ ...day, entries })
    }
    setBusy(true)
    try {
      if (updating) {
        await repo.updateCollection(holder.id, date, amount)
      } else {
        await repo.saveCollection(holder.id, date, amount)
      }
      void notifyCollection(holder, amount)
      entryEditUnlocked.current = false
      setAmountTarget(null)
      setStatus(s.amountSaved)
      refresh()
    } catch (err) {
      setDay(previous)
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
    if (!entryEditUnlocked.current) {
      requestEditPassword(() => void removeAmount())
      return
    }
    const holder = amountTarget.holder
    const previous = day
    if (day) {
      setDay({
        ...day,
        entries: renumberEntries(
          day.entries.filter((entry) => entry.holderId !== holder.id),
          day.startReceipt,
        ),
      })
    }
    setBusy(true)
    try {
      await repo.deleteCollection(holder.id, date)
      entryEditUnlocked.current = false
      setAmountTarget(null)
      setStatus(s.amountSaved)
      refresh()
    } catch (err) {
      setDay(previous)
      setAmountError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function openReassign() {
    if (!amountTarget) return
    if (locked) {
      setStatus(s.dayLockedError)
      return
    }
    setReassignFrom(amountTarget.holder)
    setReassignSearch('')
    setReassignError('')
    setAmountTarget(null)
    setReassignOpen(true)
  }

  async function reassignHolder(to: Holder) {
    if (!reassignFrom || busy) return
    if (locked) {
      setReassignError(s.dayLockedError)
      return
    }
    if (!entryEditUnlocked.current) {
      requestEditPassword(() => void reassignHolder(to))
      return
    }
    const from = reassignFrom
    const previous = day
    if (day) {
      setDay({
        ...day,
        entries: day.entries.map((entry) =>
          entry.holderId === from.id
            ? {
                ...entry,
                holderId: to.id,
                name: to.name,
                nameEn: to.nameEn,
                accountNo: to.accountNo,
                defaultAmount: to.defaultAmount,
              }
            : entry,
        ),
      })
    }
    setBusy(true)
    setReassignError('')
    try {
      await repo.reassignCollection(date, from.id, to.id)
      entryEditUnlocked.current = false
      setReassignOpen(false)
      setReassignFrom(null)
      setStatus(s.accountReassigned)
      refresh()
    } catch (err) {
      setDay(previous)
      setReassignError(
        err instanceof Error
          ? err.message === 'ALREADY_COLLECTED'
            ? s.scanAlready
            : err.message
          : String(err),
      )
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

  function closeUnlock() {
    setUnlockOpen(false)
    setUnlockPassword('')
    setUnlockError('')
    setShowUnlockPassword(false)
  }

  function openUnlock() {
    setUnlockPassword('')
    setUnlockError('')
    setShowUnlockPassword(false)
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
      closeUnlock()
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
            {locked ? <p>{s.lockedNote}</p> : null}
          </div>
          <button
            type="button"
            className={`action-pill lock-pill${locked ? ' locked' : ''}`}
            aria-label={locked ? s.unlockDay : s.lockDay}
            title={locked ? s.unlockDay : s.lockDay}
            disabled={busy}
            onClick={locked ? openUnlock : openLockConfirm}
          >
            {locked ? <UnlockIcon /> : <LockIcon />}
            <span>{locked ? s.unlockDay : s.lockDay}</span>
          </button>
        </div>
        {locked ? <p className="lock-note">{s.lockedBadge}</p> : null}

        <div className="date-nav">
          <button
            type="button"
            className="action-pill date-pill"
            aria-label={s.selectDate}
            onClick={() => setCalendarOpen(true)}
          >
            <CalendarIcon />
            <span>{formatDate(date, lang)}</span>
          </button>
          <button
            type="button"
            className="action-pill scan-pill"
            aria-label={s.scanEntries}
            disabled={busy || locked}
            onClick={() => setScanOpen(true)}
          >
            <CameraIcon />
            <span>{s.scanEntries}</span>
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

        {receiptsEnabled ? (
          <div className="receipt-label">
            <label htmlFor="startReceipt">{s.startingReceipt}</label>
          </div>
        ) : null}

        <div className="hero-meta">
          {receiptsEnabled ? (
            <div className="stepper">
              <button
                type="button"
                aria-label={s.startingReceipt}
                disabled={busy || locked || receiptLocked}
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
                disabled={busy || locked || receiptLocked}
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
                disabled={busy || locked || receiptLocked}
                onClick={() =>
                  void commitStart(
                    (Number(startDraft) || day?.startReceipt || 1) + 1,
                  )
                }
              >
                <PlusIcon />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="action-pill print-pill"
            aria-label={s.printKara}
            title={s.printKara}
            disabled={busy || collectedCount === 0}
            onClick={() => setPdfOpen(true)}
          >
            <PrinterIcon />
            <span>{s.printKara}</span>
          </button>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-text">
              <small>{s.totalAccounts}</small>
              <b>{formatDigits(holders.length, lang)}</b>
            </div>
            <span className="stat-icon accounts">
              <UsersIcon />
            </span>
          </div>
          <div className="stat">
            <div className="stat-text">
              <small>{s.collected}</small>
              <b>
                {formatDigits(collectedCount, lang)} /{' '}
                {formatDigits(holders.length, lang)}
              </b>
            </div>
            <span className="stat-icon collected">
              <CheckIcon />
            </span>
          </div>
          <div className="stat">
            <div className="stat-text">
              <small>{s.uncollected}</small>
              <b>{formatDigits(pendingCount, lang)}</b>
            </div>
            <span className="stat-icon pending">
              <ClockIcon />
            </span>
          </div>
          <div className="stat">
            <div className="stat-text">
              <small>{isToday ? s.todayAmount : s.dayAmount}</small>
              <b>{formatRupees(total, lang)}</b>
            </div>
            <span className="stat-icon amount">
              <WalletIcon />
            </span>
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

          <div
            className={`list-head${receiptsEnabled ? '' : ' no-receipt'}`}
            aria-hidden
          >
            <span className="c">{s.srNo}</span>
            <span>{s.name}</span>
            {receiptsEnabled ? (
              <span className="c">{s.receiptShort}</span>
            ) : null}
            <span className="r list-amount-head">
              <span>{s.amount}</span>
            </span>
            <span className="list-count-cell">
              {formatDigits(visibleHolders.length, lang)}
            </span>
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
                  className={`row${receiptsEnabled ? '' : ' no-receipt'}${
                    index < ENTER_ROW_LIMIT ? ' enter' : ''
                  }${isDone ? ' done' : ''}`}
                  style={
                    index < ENTER_ROW_LIMIT
                      ? { animationDelay: `${index * 0.03}s` }
                      : undefined
                  }
                >
                  <div className="sr">{formatDigits(index + 1, lang)}</div>
                  <div className="who">
                    <b>{holderName(holder.name, holder.nameEn, lang)}</b>
                    <small>
                      {s.accountNoShort}{' '}
                      {formatDigits(holder.accountNo, lang)}
                    </small>
                  </div>
                  {receiptsEnabled ? (
                    <div className={`receipt${isDone ? ' filled' : ''}`}>
                      {entry ? formatReceipt(entry.receiptNo, lang) : '—'}
                    </div>
                  ) : null}
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
      </div>

      {pdfOpen ? (
        <BottomSheet
          title={s.sharePdf}
          closeLabel={s.close}
          onClose={() => {
            if (!busy) setPdfOpen(false)
          }}
        >
          {receiptsEnabled ? (
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
          ) : null}

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
          onClose={() => {
            entryEditUnlocked.current = false
            setAmountTarget(null)
          }}
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
                  amount: Number(decimalOnly(event.target.value)),
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
                className="btn-ghost"
                disabled={busy || locked}
                onClick={openReassign}
              >
                {s.changeAccount}
              </button>
            ) : null}
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

      {reassignOpen && reassignFrom ? (
        <BottomSheet
          title={s.changeAccountTitle}
          closeLabel={s.close}
          onClose={closeReassign}
        >
          <p className="field-hint">{s.changeAccountHint}</p>
          <div className="amount-holder">
            <b>{holderName(reassignFrom.name, reassignFrom.nameEn, lang)}</b>
            <small>
              {s.accountNoShort} {formatDigits(reassignFrom.accountNo, lang)}
            </small>
          </div>

          <div className="searchbar glass">
            <SearchIcon />
            <input
              type="search"
              value={reassignSearch}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={s.searchCollection}
              onChange={(event) => setReassignSearch(event.target.value)}
            />
          </div>

          {reassignError ? (
            <p className="form-error">{reassignError}</p>
          ) : null}

          {reassignCandidates.length === 0 ? (
            <div className="empty glass compact">
              <p>{s.noData}</p>
            </div>
          ) : (
            <section className="list">
              {reassignCandidates.map((holder, index) => (
                <div key={holder.id} className="picker-row">
                  <div className="sr">{formatDigits(index + 1, lang)}</div>
                  <div className="who">
                    <b>{holderName(holder.name, holder.nameEn, lang)}</b>
                    <small>
                      {s.accountNoShort}{' '}
                      {formatDigits(holder.accountNo, lang)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="picker-action"
                    disabled={busy}
                    onClick={() => void reassignHolder(holder)}
                  >
                    {s.changeAccount}
                  </button>
                </div>
              ))}
            </section>
          )}
        </BottomSheet>
      ) : null}

      {editPassOpen ? (
        <BottomSheet
          title={s.entryLockTitle}
          closeLabel={s.close}
          onClose={closeEditPassword}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={closeEditPassword}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={submitEditPassword}
              >
                {s.unlock}
              </button>
            </>
          }
        >
          <p className="field-hint">{s.entryLockHint}</p>
          <div className="field">
            <label htmlFor="editPassword">{s.masterPassword}</label>
            <div className="input-group">
              <input
                id="editPassword"
                type={showEditPassword ? 'text' : 'password'}
                value={editPassInput}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setEditPassInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitEditPassword()
                }}
              />
              <button
                type="button"
                className="input-toggle-btn"
                aria-label={
                  showEditPassword ? s.hidePassword : s.showPassword
                }
                title={showEditPassword ? s.hidePassword : s.showPassword}
                onClick={() => setShowEditPassword((value) => !value)}
              >
                {showEditPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          {editPassError ? (
            <p className="form-error">{editPassError}</p>
          ) : null}
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
          onClose={closeUnlock}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={closeUnlock}
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
            <div className="input-group">
              <input
                id="unlockPassword"
                type={showUnlockPassword ? 'text' : 'password'}
                value={unlockPassword}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => setUnlockPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitUnlock()
                }}
              />
              <button
                type="button"
                className="input-toggle-btn"
                aria-label={
                  showUnlockPassword ? s.hidePassword : s.showPassword
                }
                title={
                  showUnlockPassword ? s.hidePassword : s.showPassword
                }
                onClick={() => setShowUnlockPassword((value) => !value)}
              >
                {showUnlockPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
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
          receiptsEnabled={receiptsEnabled}
          collectedHolderIds={collectedHolderIds}
          existingReceipts={existingReceipts}
          existingEntries={day?.entries ?? []}
          onClose={() => setScanOpen(false)}
          onSaved={(count) => {
            setScanOpen(false)
            refresh()
            setStatus(`${formatDigits(count, lang)} ${s.scanSaved}`)
          }}
        />
      ) : null}

      <ScrollTopButton />
    </>
  )
}
