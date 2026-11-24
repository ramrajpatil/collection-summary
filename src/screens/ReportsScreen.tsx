import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import type {
  HolderHistory,
  MonthlyHolderRow,
  MonthlyReport,
  Profile,
} from '../lib/models'
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
  buildMonthlySheetHtml,
  generateNativePdf,
  openPrintPreview,
  sharePdf,
} from '../lib/sheets'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocIcon,
  PercentIcon,
  UsersIcon,
  WalletIcon,
} from '../components/Icons'
import { BottomSheet } from '../components/BottomSheet'
import { Toast } from '../components/Toast'
import { ScrollTopButton } from '../components/ScrollTopButton'
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
  const [detailHolder, setDetailHolder] = useState<MonthlyHolderRow | null>(null)
  const [detail, setDetail] = useState<HolderHistory | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const detailHolderId = detailHolder?.holderId ?? null

  useEffect(() => {
    if (detailHolderId === null) return
    let cancelled = false
    repo
      .getHolderHistory(detailHolderId)
      .then((next) => {
        if (!cancelled) setDetail(next)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailHolderId, repo])

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
    if (!historyOpen) return
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
  }, [repo, historyOpen])

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
          <div className="stats">
            <div className="stat">
              <div className="stat-text">
                <small>{s.monthlyTotal}</small>
                <b>{formatRupees(report.total, lang)}</b>
              </div>
              <span className="stat-icon amount">
                <WalletIcon />
              </span>
            </div>
            <div className="stat highlight">
              <div className="stat-text">
                <small>
                  {s.commission} · {s.commissionRate}
                </small>
                <b>{formatRupees(report.commission, lang)}</b>
              </div>
              <span className="stat-icon commission">
                <PercentIcon />
              </span>
            </div>
            <div className="stat">
              <div className="stat-text">
                <small>{s.days}</small>
                <b>{formatDigits(report.days, lang)}</b>
              </div>
              <span className="stat-icon days">
                <CalendarIcon />
              </span>
            </div>
            <div className="stat">
              <div className="stat-text">
                <small>{s.accounts}</small>
                <b>{formatDigits(report.accounts, lang)}</b>
              </div>
              <span className="stat-icon accounts">
                <UsersIcon />
              </span>
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
                <button
                  type="button"
                  className="report-holder"
                  key={holder.holderId}
                  onClick={() => {
                    setDetail(null)
                    setDetailLoading(true)
                    setDetailHolder(holder)
                  }}
                >
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
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {detailHolder ? (
        <BottomSheet
          title={holderName(detailHolder.name, detailHolder.nameEn, lang)}
          closeLabel={s.close}
          centered
          onClose={() => setDetailHolder(null)}
        >
          <div className="holder-dates-info">
            <div className="holder-dates-stat">
              <small>{s.accountNoShort}</small>
              <b>{formatDigits(detailHolder.accountNo, lang)}</b>
            </div>
            <div className="holder-dates-stat">
              <small>{s.holderTotal}</small>
              <b>{formatRupees(detail?.total ?? detailHolder.total, lang)}</b>
            </div>
            <div className="holder-dates-stat">
              <small>{s.days}</small>
              <b>{formatDigits(detail?.days ?? detailHolder.days, lang)}</b>
            </div>
          </div>

          {detailLoading ? (
            <div className="holder-dates-loading">
              <span className="spinner" />
            </div>
          ) : !detail || detail.entries.length === 0 ? (
            <p className="holder-dates-empty">{s.noHistory}</p>
          ) : (
            <div className="holder-dates">
              {detail.entries.map((entry) => (
                <div className="holder-date-row" key={entry.date}>
                  <b>{formatDate(entry.date, lang)}</b>
                  <span>{formatRupees(entry.amount, lang)}</span>
                </div>
              ))}
            </div>
          )}
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

      <ScrollTopButton />
    </>
  )
}
