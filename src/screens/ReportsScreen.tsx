import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type { MonthlyReport, Profile } from '../lib/models'
import type { Repository } from '../lib/repo'
import { STRINGS, useLanguage } from '../lib/i18n'
import {
  formatDate,
  formatDigits,
  formatMonth,
  formatRupees,
} from '../lib/marathi'
import { holderName } from '../lib/names'
import {
  buildDailySheetHtml,
  buildMonthlySheetHtml,
  generateNativePdf,
  openPrintPreview,
  sharePdf,
} from '../lib/sheets'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocIcon,
} from '../components/Icons'
import { Toast } from '../components/Toast'
import { currentMonth, shiftMonth } from '../lib/reports'

interface ReportsScreenProps {
  repo: Repository
  profile: Profile
}

export function ReportsScreen({ repo, profile }: ReportsScreenProps) {
  const { lang } = useLanguage()
  const s = STRINGS[lang]

  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [history, setHistory] = useState<
    { month: string; total: number; commission: number }[]
  >([])
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    const state = { cancelled: false }
    repo
      .getMonthlyReport(month)
      .then((next) => {
        if (!state.cancelled) setReport(next)
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
  }, [repo, month, s.failed])

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(''), 6000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    let cancelled = false
    const months = Array.from({ length: 6 }, (_, index) =>
      shiftMonth(currentMonth(), -index),
    )
    Promise.all(months.map((item) => repo.getMonthlyReport(item)))
      .then((reports) => {
        if (cancelled) return
        setHistory(
          reports.map((item) => ({
            month: item.month,
            total: item.total,
            commission: item.commission,
          })),
        )
      })
      .catch(() => {
        void 0
      })
    return () => {
      cancelled = true
    }
  }, [repo])

  function goToMonth(next: string) {
    if (next === month) return
    setLoading(true)
    setMonth(next)
  }

  async function generateMonthly() {
    if (!report || busy) return
    setBusy(true)
    setStatus('')
    try {
      const html = buildMonthlySheetHtml(report, profile, lang)
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
        `monthly-${report.month}.pdf`,
      )
      await sharePdf(result, s.shareTitle, s.reportShared)
      setStatus(s.reportShared)
    } catch (err) {
      setStatus(
        `${s.pdfFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function generateDaily(date: string) {
    if (busy) return
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
      await sharePdf(result, s.shareTitle, s.shareText)
      setStatus(s.pdfSaved)
    } catch (err) {
      setStatus(
        `${s.pdfFailed} ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>{s.reportsTitle}</h1>
          <p>{s.reportsSubtitle}</p>
        </div>
      </div>

      <div className="month-nav glass">
        <button
          type="button"
          className="icon-btn"
          aria-label={s.prevMonth}
          onClick={() => goToMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </button>
        <div className="month-label">
          <b>{formatMonth(month, lang)}</b>
          {report ? (
            <small>
              {s.period}: {formatDate(report.periodStart, lang)} –{' '}
              {formatDate(report.periodEnd, lang)}
            </small>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={s.nextMonth}
          onClick={() => goToMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>

      {month !== currentMonth() ? (
        <button
          type="button"
          className="btn-ghost compact centered"
          onClick={() => goToMonth(currentMonth())}
        >
          {s.currentMonth}
        </button>
      ) : null}

      {loading || !report ? (
        <div className="screen-loading">
          <span className="spinner large" />
          <p>{s.loading}</p>
        </div>
      ) : (
        <>
          <div className="report-cards">
            <div className="report-card">
              <small>{s.monthlyTotal}</small>
              <b>{formatRupees(report.total, lang)}</b>
            </div>
            <div className="report-card highlight">
              <small>
                {s.commission} · {s.commissionRate}
              </small>
              <b>{formatRupees(report.commission, lang)}</b>
            </div>
            <div className="report-card">
              <small>{s.days}</small>
              <b>{formatDigits(report.days, lang)}</b>
            </div>
            <div className="report-card">
              <small>{s.accounts}</small>
              <b>{formatDigits(report.accounts, lang)}</b>
            </div>
          </div>

          <p className="commission-note">{s.commissionNote}</p>

          <button
            type="button"
            className="btn-primary wide"
            onClick={() => void generateMonthly()}
            disabled={busy || report.holders.length === 0}
          >
            {busy ? <span className="spinner" /> : <DocIcon />}
            {s.reportPdf}
          </button>

          <button
            type="button"
            className={`commission-toggle${historyOpen ? ' open' : ''}`}
            aria-expanded={historyOpen}
            aria-controls="commission-history"
            onClick={() => setHistoryOpen((value) => !value)}
          >
            <span>{s.commissionHistory}</span>
            <ChevronRightIcon />
          </button>
          {historyOpen ? (
            <section id="commission-history" className="commission-history">
              {history.map((row) => (
                <button
                  key={row.month}
                  type="button"
                  className={`commission-row${
                    row.month === month ? ' active' : ''
                  }`}
                  onClick={() => goToMonth(row.month)}
                >
                  <span className="commission-month">
                    <b>{formatMonth(row.month, lang)}</b>
                    <small>
                      {s.monthlyTotal}: {formatRupees(row.total, lang)}
                    </small>
                  </span>
                  <span className="commission-value">
                    <small>{s.commission}</small>
                    <b>{formatRupees(row.commission, lang)}</b>
                  </span>
                </button>
              ))}
            </section>
          ) : null}

          <div className="section-title">
            <h2>{s.monthlyReport}</h2>
            <span>
              {formatDigits(report.holders.length, lang)} {s.accounts}
            </span>
          </div>

          {report.holders.length === 0 ? (
            <div className="empty glass compact">
              <p>{s.noReportData}</p>
            </div>
          ) : (
            <section className="report-holders">
              {report.holders.map((holder) => (
                <div className="report-holder" key={holder.holderId}>
                  <div className="report-holder-main">
                    <b>{holderName(holder.name, holder.nameEn, lang)}</b>
                    <small>
                      {s.accountNoShort}{' '}
                      {formatDigits(holder.accountNo, lang)} ·{' '}
                      {formatDigits(holder.days, lang)} {s.days}
                    </small>
                  </div>
                  <div className="report-holder-amount">
                    <b>{formatRupees(holder.total, lang)}</b>
                    <small>
                      {s.commission}:{' '}
                      {formatRupees(holder.commission, lang)}
                    </small>
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className="section-title">
            <h2>{s.dailySheets}</h2>
            <span>
              {formatDigits(report.daily.length, lang)} {s.collectedDays}
            </span>
          </div>

          {report.daily.length === 0 ? (
            <div className="empty glass compact">
              <p>{s.noReportData}</p>
            </div>
          ) : (
            <section className="report-days">
              {report.daily.map((day) => (
                <div className="report-day" key={day.date}>
                  <div>
                    <b>{formatDate(day.date, lang)}</b>
                    <small>
                      {formatDigits(day.count, lang)} {s.accounts} ·{' '}
                      {formatRupees(day.total, lang)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={s.regenerateSheet}
                    disabled={busy}
                    onClick={() => void generateDaily(day.date)}
                  >
                    <DocIcon />
                  </button>
                </div>
              ))}
            </section>
          )}
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
    </>
  )
}
