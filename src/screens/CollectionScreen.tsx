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
import { pushBackHandler } from '../lib/backButton'
import {
  buildDailySheetHtml,
  canSharePdf,
  generateNativePdf,
  openPrintPreview,
  sharePdf,
} from '../lib/sheets'
import { BottomSheet } from '../components/BottomSheet'
import { DatePicker } from '../components/DatePicker'
import { Toast } from '../components/Toast'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  UsersIcon,
} from '../components/Icons'

interface CollectionScreenProps {
  repo: Repository
  profile: Profile
  onGoToHolders: () => void
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500]

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
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [startDraft, setStartDraft] = useState('0001')
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null)
  const [amountError, setAmountError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'collected' | 'pending'>('all')
  const [calendarOpen, setCalendarOpen] = useState(false)

  const refresh = () => setReloadToken((token) => token + 1)
  const isToday = date === today

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
    Promise.all([
      repo.getDay(date),
      repo.listHolders({ status: 'active', sort: 'account' }),
    ])
      .then(([nextDay, nextHolders]) => {
        if (state.cancelled) return
        setDay(nextDay)
        setHolders(nextHolders)
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
    if (!amountTarget && !calendarOpen) return
    return pushBackHandler(() => {
      if (amountTarget) {
        setAmountTarget(null)
        setAmountError('')
        return true
      }
      setCalendarOpen(false)
      return true
    })
  }, [amountTarget, calendarOpen])

  const entryByHolder = useMemo(() => {
    const map = new Map<number, DayData['entries'][number]>()
    day?.entries.forEach((entry) => map.set(entry.holderId, entry))
    return map
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

  async function handlePdf(share: boolean) {
    if (busy) return
    if (!day || day.entries.length === 0) {
      setStatus(s.noEntries)
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const html = await buildDailySheetHtml(repo, profile, date, lang)
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
      const result = await generateNativePdf(html, `vasuli-${date}.pdf`)
      if (share) {
        await sharePdf(result, s.shareTitle, s.shareText)
        setStatus(s.pdfSaved)
      } else {
        setStatus(
          `${s.pdfSaved} ${result.path} (${Math.round(result.size / 1024)} KB)`,
        )
      }
    } catch (err) {
      setStatus(
        `${s.pdfFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
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
            <p>{s.tapToCollect}</p>
          </div>
        </div>

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
                disabled={busy}
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
                value={formatDigits(startDraft, lang)}
                disabled={busy}
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
                disabled={busy}
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
          <div className="searchbar glass">
            <SearchIcon />
            <input
              type="search"
              value={search}
              placeholder={s.searchCollection}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="filter-row">
            <div className="segmented">
              <button
                type="button"
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                {s.filterAll}
              </button>
              <button
                type="button"
                className={filter === 'pending' ? 'active' : ''}
                onClick={() => setFilter('pending')}
              >
                {s.filterPending}
              </button>
              <button
                type="button"
                className={filter === 'collected' ? 'active' : ''}
                onClick={() => setFilter('collected')}
              >
                {s.filterCollected}
              </button>
            </div>
            <span className="list-count">
              {formatDigits(visibleHolders.length, lang)}
            </span>
          </div>

          <div className="list-head" aria-hidden>
            <span className="c">{s.srNo}</span>
            <span>{s.name}</span>
            <span className="c">{s.receiptShort}</span>
            <span className="r">{s.amount}</span>
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
                  style={{ animationDelay: `${index * 0.03}s` }}
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
                    disabled={busy}
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
          {canSharePdf() ? (
            <button
              type="button"
              className="icon-btn"
              aria-label={s.sharePdf}
              disabled={busy || collectedCount === 0}
              onClick={() => void handlePdf(true)}
            >
              <ShareIcon />
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handlePdf(false)}
            disabled={busy || collectedCount === 0}
          >
            {busy ? <span className="spinner" /> : <DocIcon />}
            {s.generatePdf}
          </button>
        </div>
      </div>

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

      {calendarOpen ? (
        <DatePicker
          value={date}
          max={today}
          onSelect={(next) => changeDate(next)}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
    </>
  )
}
