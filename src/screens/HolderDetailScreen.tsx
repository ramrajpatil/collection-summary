import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type {
  BalanceJournalEntry,
  HolderBalance,
  HolderHistory,
  Profile,
} from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import { pushBackHandler } from '../lib/backButton'
import {
  formatDate,
  formatDigits,
  formatReceipt,
  formatRupees,
  todayIso,
} from '../lib/marathi'
import { holderName } from '../lib/names'
import {
  buildHolderStatementHtml,
  generateNativePdf,
  openPrintPreview,
  sharePdf,
} from '../lib/sheets'
import {
  normalizePhone,
  openExternal,
  reminderMessage,
  smsUrl,
  telUrl,
  whatsappUrl,
} from '../lib/reminders'
import { BottomSheet } from '../components/BottomSheet'
import { DatePicker } from '../components/DatePicker'
import { Toast } from '../components/Toast'
import {
  ChatIcon,
  ChevronLeftIcon,
  CopyIcon,
  DocIcon,
  EditIcon,
  MinusIcon,
  PhoneIcon,
  WalletIcon,
} from '../components/Icons'

interface HolderDetailScreenProps {
  repo: Repository
  profile: Profile
  holderId: number
  onBack: () => void
  onEdit: () => void
}

export function HolderDetailScreen({
  repo,
  profile,
  holderId,
  onBack,
  onEdit,
}: HolderDetailScreenProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]

  const [history, setHistory] = useState<HolderHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [reminderOpen, setReminderOpen] = useState(false)
  const [balance, setBalance] = useState<HolderBalance | null>(null)
  const [balanceToken, setBalanceToken] = useState(0)
  const [balanceBusy, setBalanceBusy] = useState(false)
  const [balanceError, setBalanceError] = useState('')
  const [openingOpen, setOpeningOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingDate, setOpeningDate] = useState(todayIso())
  const [openingPicker, setOpeningPicker] = useState(false)
  const [reductionOpen, setReductionOpen] = useState(false)
  const [reductionAmount, setReductionAmount] = useState('')
  const [reductionDate, setReductionDate] = useState(todayIso())
  const [reductionPicker, setReductionPicker] = useState(false)

  useEffect(() => {
    const state = { cancelled: false }
    repo
      .getHolderHistory(holderId)
      .then((next) => {
        if (!state.cancelled) setHistory(next)
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
  }, [repo, holderId, s.failed])

  useEffect(() => {
    let cancelled = false
    repo
      .getHolderBalance(holderId)
      .then((next) => {
        if (!cancelled) setBalance(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [repo, holderId, balanceToken])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (
      !reminderOpen &&
      !openingOpen &&
      !reductionOpen &&
      !openingPicker &&
      !reductionPicker
    ) {
      return
    }
    return pushBackHandler(() => {
      if (openingPicker) {
        setOpeningPicker(false)
        return true
      }
      if (reductionPicker) {
        setReductionPicker(false)
        return true
      }
      if (reminderOpen) {
        setReminderOpen(false)
        return true
      }
      if (openingOpen) {
        setOpeningOpen(false)
        return true
      }
      if (reductionOpen) {
        setReductionOpen(false)
        return true
      }
      return true
    })
  }, [reminderOpen, openingOpen, reductionOpen, openingPicker, reductionPicker])

  const phone = normalizePhone(history?.holder.phone)
  const message = history
    ? reminderMessage(profile, lang, history.holder, history.holder.defaultAmount)
    : ''

  async function generateStatement() {
    if (!history || busy) return
    setBusy(true)
    setStatus('')
    try {
      const html = buildHolderStatementHtml(history, profile, lang)
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
      const result = await generateNativePdf(
        html,
        `statement-${history.holder.accountNo}.pdf`,
      )
      await sharePdf(result, s.holderHistory, s.shareText)
      setStatus(s.pdfSaved)
    } catch (err) {
      setStatus(
        `${s.pdfFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setStatus(s.copied)
      setReminderOpen(false)
    } catch {
      setStatus(s.failed)
    }
  }

  function openOpeningSheet() {
    setOpeningAmount(
      balance?.openingAmount ? String(balance.openingAmount) : '',
    )
    setOpeningDate(balance?.openingDate ?? todayIso())
    setBalanceError('')
    setOpeningOpen(true)
  }

  async function saveOpeningBalance() {
    if (balanceBusy) return
    const amount = Number(openingAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      setBalanceError(s.amountInvalid)
      return
    }
    setBalanceBusy(true)
    setBalanceError('')
    try {
      await repo.setOpeningBalance(holderId, amount, openingDate)
      setOpeningOpen(false)
      setStatus(s.balanceSaved)
      setBalanceToken((token) => token + 1)
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : String(err))
    } finally {
      setBalanceBusy(false)
    }
  }

  function openReductionSheet() {
    setReductionAmount('')
    setReductionDate(todayIso())
    setBalanceError('')
    setReductionOpen(true)
  }

  async function saveReduction() {
    if (balanceBusy) return
    const amount = Number(reductionAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setBalanceError(s.amountInvalid)
      return
    }
    setBalanceBusy(true)
    setBalanceError('')
    try {
      await repo.addBalanceReduction(holderId, amount, reductionDate)
      setReductionOpen(false)
      setStatus(s.balanceSaved)
      setBalanceToken((token) => token + 1)
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : String(err))
    } finally {
      setBalanceBusy(false)
    }
  }

  function journalLabel(type: BalanceJournalEntry['type']): string {
    if (type === 'opening') return s.openingBalance
    if (type === 'reduction') return s.balanceReduction
    return s.collectionEntry
  }

  return (
    <>
      <div className="screen-head detail-head">
        <button
          type="button"
          className="icon-btn"
          aria-label={s.back}
          onClick={onBack}
        >
          <ChevronLeftIcon />
        </button>
        <div>
          <h1>
            {history
              ? holderName(history.holder.name, history.holder.nameEn, lang)
              : s.holderDetail}
          </h1>
          <p>
            {history
              ? `${s.accountNoShort} ${formatDigits(
                  history.holder.accountNo,
                  lang,
                )} · ${
                  history.holder.active ? s.holderActive : s.holderInactive
                }`
              : ''}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={s.edit}
          onClick={onEdit}
        >
          <EditIcon />
        </button>
      </div>

      {loading || !history ? (
        <div className="screen-loading">
          <span className="spinner large" />
          <p>{s.loading}</p>
        </div>
      ) : (
        <>
          <div className="report-cards">
            <div className="report-card highlight">
              <small>{s.holderTotal}</small>
              <b>{formatRupees(history.total, lang)}</b>
            </div>
            <div className="report-card">
              <small>{s.days}</small>
              <b>{formatDigits(history.days, lang)}</b>
            </div>
            <div className="report-card">
              <small>{s.firstCollection}</small>
              <b className="card-date">
                {history.firstDate ? formatDate(history.firstDate, lang) : '—'}
              </b>
            </div>
            <div className="report-card">
              <small>{s.lastCollection}</small>
              <b className="card-date">
                {history.lastDate ? formatDate(history.lastDate, lang) : '—'}
              </b>
            </div>
          </div>

          <div className="detail-actions">
            {phone ? (
              <div className="detail-action-row">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openExternal(telUrl(phone))}
                >
                  <PhoneIcon />
                  <span className="action-label">{s.callHolder}</span>
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openExternal(whatsappUrl(phone, message))}
                >
                  <ChatIcon />
                  <span className="action-label">{s.whatsapp}</span>
                </button>
              </div>
            ) : null}
            <div className="detail-action-row">
              <button
                type="button"
                className="btn-ghost"
                disabled={!phone}
                onClick={() => setReminderOpen(true)}
              >
                <ChatIcon />
                <span className="action-label">{s.reminder}</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || history.entries.length === 0}
                onClick={() => void generateStatement()}
              >
                {busy ? <span className="spinner" /> : <DocIcon />}
                <span className="action-label">{s.sendReport}</span>
              </button>
            </div>
            <div className="detail-action-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={openOpeningSheet}
              >
                <WalletIcon />
                <span className="action-label">{s.openingBalance}</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={openReductionSheet}
              >
                <MinusIcon />
                <span className="action-label">{s.reduceBalance}</span>
              </button>
            </div>
          </div>

          {balance ? (
            <section className="balance-card">
              <div className="balance-top">
                <div>
                  <small>{s.currentBalance}</small>
                  <b>{formatRupees(balance.current, lang)}</b>
                </div>
                <div className="balance-opening">
                  <small>{s.openingBalance}</small>
                  <span>
                    {balance.openingAmount
                      ? formatRupees(balance.openingAmount, lang)
                      : '—'}
                  </span>
                  <small>
                    {balance.openingDate
                      ? `${s.recordedOn}: ${formatDate(balance.openingDate, lang)}`
                      : s.noOpeningBalance}
                  </small>
                </div>
              </div>
              {balance.journal.length > 0 ? (
                <div className="balance-list">
                  <div className="balance-list-head">
                    <span>{s.balanceJournal}</span>
                    <span>{formatDigits(balance.journal.length, lang)}</span>
                  </div>
                  {balance.journal.map((entry) => (
                    <div className="balance-row" key={entry.key}>
                      <span>
                        {journalLabel(entry.type)}
                        <small>
                          {formatDate(entry.date, lang)}
                          {entry.reference
                            ? ` · ${s.receiptShort} ${formatReceipt(
                                entry.reference,
                                lang,
                              )}`
                            : ''}
                        </small>
                      </span>
                      <b className={entry.amount >= 0 ? 'credit' : 'debit'}>
                        {entry.amount >= 0 ? '+' : '−'}{' '}
                        {formatRupees(Math.abs(entry.amount), lang)}
                      </b>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {!phone ? (
            <p className="field-hint">{s.reminderNeedsPhone}</p>
          ) : null}

          <div className="section-title">
            <h2>{s.holderHistory}</h2>
            <span>
              {formatDigits(history.entries.length, lang)} {s.days}
            </span>
          </div>

          {history.entries.length === 0 ? (
            <div className="empty glass compact">
              <p>{s.noHistory}</p>
            </div>
          ) : (
            <div className="list-head history-head" aria-hidden>
              <span className="c">{s.srNo}</span>
              <span>{s.dateLabel}</span>
              <span className="c">{s.receiptShort}</span>
              <span className="r">{s.amount}</span>
            </div>
          )}

          {history.entries.length > 0 ? (
            <section className="history-list">
              {history.entries.map((entry, index) => (
                <div
                  className="history-row glass"
                  key={`${entry.date}-${entry.receiptNo}`}
                  style={{ animationDelay: `${Math.min(index, 12) * 0.02}s` }}
                >
                  <span className="c">{formatDigits(index + 1, lang)}</span>
                  <b>{formatDate(entry.date, lang)}</b>
                  <span className="c">
                    {formatReceipt(entry.receiptNo, lang)}
                  </span>
                  <span className="r">{formatRupees(entry.amount, lang)}</span>
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      {status ? (
        <Toast
          key={status}
          message={status}
          onDismiss={() => setStatus('')}
          dismissLabel={s.close}
        />
      ) : null}

      {reminderOpen && history && phone ? (
        <BottomSheet
          title={s.reminderTitle}
          closeLabel={s.close}
          onClose={() => setReminderOpen(false)}
        >
          <div className="reminder-preview">{message}</div>
          <div className="reminder-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                openExternal(whatsappUrl(phone, message))
                setReminderOpen(false)
              }}
            >
              <ChatIcon />
              {s.whatsapp}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                openExternal(smsUrl(phone, message))
                setReminderOpen(false)
              }}
            >
              <ChatIcon />
              {s.sms}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void copyMessage()}
            >
              <CopyIcon />
              {s.copy}
            </button>
          </div>
        </BottomSheet>
      ) : null}

      {openingOpen ? (
        <BottomSheet
          title={s.setOpeningBalance}
          closeLabel={s.close}
          onClose={() => setOpeningOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={balanceBusy}
                onClick={() => setOpeningOpen(false)}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={balanceBusy}
                onClick={() => void saveOpeningBalance()}
              >
                {balanceBusy ? <span className="spinner" /> : null}
                {s.save}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="openingAmount">{s.amount}</label>
            <input
              id="openingAmount"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              value={openingAmount}
              onChange={(event) => setOpeningAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-label">{s.recordedOn}</span>
            <button
              type="button"
              className="export-date"
              onClick={() => setOpeningPicker(true)}
            >
              <small>{s.dateLabel}</small>
              <b>{formatDate(openingDate, lang)}</b>
            </button>
          </div>
          {balanceError ? <p className="form-error">{balanceError}</p> : null}
        </BottomSheet>
      ) : null}

      {reductionOpen ? (
        <BottomSheet
          title={s.reduceBalance}
          closeLabel={s.close}
          onClose={() => setReductionOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn-ghost"
                disabled={balanceBusy}
                onClick={() => setReductionOpen(false)}
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={balanceBusy}
                onClick={() => void saveReduction()}
              >
                {balanceBusy ? <span className="spinner" /> : null}
                {s.save}
              </button>
            </>
          }
        >
          <div className="field">
            <label htmlFor="reductionAmount">{s.amount}</label>
            <input
              id="reductionAmount"
              type="number"
              min={0}
              step="1"
              inputMode="decimal"
              value={reductionAmount}
              onChange={(event) => setReductionAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <span className="field-label">{s.recordedOn}</span>
            <button
              type="button"
              className="export-date"
              onClick={() => setReductionPicker(true)}
            >
              <small>{s.dateLabel}</small>
              <b>{formatDate(reductionDate, lang)}</b>
            </button>
          </div>
          {balanceError ? <p className="form-error">{balanceError}</p> : null}
        </BottomSheet>
      ) : null}

      {openingPicker ? (
        <DatePicker
          value={openingDate}
          max={todayIso()}
          onSelect={setOpeningDate}
          onClose={() => setOpeningPicker(false)}
        />
      ) : null}

      {reductionPicker ? (
        <DatePicker
          value={reductionDate}
          max={todayIso()}
          onSelect={setReductionDate}
          onClose={() => setReductionPicker(false)}
        />
      ) : null}
    </>
  )
}
