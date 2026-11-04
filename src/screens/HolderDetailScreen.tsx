import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { HolderHistory, Profile } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import { formatDate, formatDigits, formatRupees } from '../lib/marathi'
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
import {
  ChatIcon,
  ChevronLeftIcon,
  CopyIcon,
  DocIcon,
  EditIcon,
  PhoneIcon,
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
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

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
          <h1>{history?.holder.name ?? s.holderDetail}</h1>
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
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openExternal(telUrl(phone))}
                >
                  <PhoneIcon />
                  {s.callHolder}
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => openExternal(whatsappUrl(phone, message))}
                >
                  <ChatIcon />
                  {s.whatsapp}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn-ghost"
              disabled={!phone}
              onClick={() => setReminderOpen(true)}
            >
              <ChatIcon />
              {s.reminder}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || history.entries.length === 0}
              onClick={() => void generateStatement()}
            >
              {busy ? <span className="spinner" /> : <DocIcon />}
              {s.statementPdf}
            </button>
          </div>

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
                  style={{ animationDelay: `${index * 0.02}s` }}
                >
                  <span className="c">{formatDigits(index + 1, lang)}</span>
                  <b>{formatDate(entry.date, lang)}</b>
                  <span className="c">
                    {formatDigits(entry.receiptNo, lang)}
                  </span>
                  <span className="r">{formatRupees(entry.amount, lang)}</span>
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      {status ? <div className="toast glass">{status}</div> : null}

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
    </>
  )
}
