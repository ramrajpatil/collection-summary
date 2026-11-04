import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import type { HolderHistory, MonthlyReport, Profile } from './models'
import type { Repository } from './repo'
import { STRINGS, type Lang } from './i18n'
import { formatDate, formatMonth } from './marathi'
import { holderName } from './names'
import {
  buildMonthlyHtml,
  buildSheetHtml,
  buildStatementHtml,
  computeDenominations,
  type MonthlySheetData,
  type SheetData,
  type StatementData,
} from './pdfTemplate'
import { PdfGenerator, type PdfGeneratorResult } from './pdf'

export async function buildDailySheetHtml(
  repo: Repository,
  profile: Profile,
  date: string,
  lang: Lang,
): Promise<string | null> {
  const day = await repo.getDay(date)
  if (day.entries.length === 0) return null
  const s = STRINGS[lang]
  const total = day.entries.reduce((sum, entry) => sum + entry.amount, 0)
  const data: SheetData = {
    societyName: profile.societyName,
    address: profile.address,
    heading: s.pdfTitle,
    dateIso: date,
    rows: day.entries.map((entry, index) => ({
      sr: index + 1,
      name: holderName(entry.name, entry.nameEn, lang),
      accountNo: entry.accountNo,
      receiptNo: entry.receiptNo,
      amount: entry.amount,
    })),
    denominations: computeDenominations(total),
    agentName: profile.agentName,
    managerName: profile.managerName,
  }
  return buildSheetHtml(data, lang)
}

export function buildMonthlySheetHtml(
  report: MonthlyReport,
  profile: Profile,
  lang: Lang,
): string {
  const s = STRINGS[lang]
  const data: MonthlySheetData = {
    societyName: profile.societyName,
    address: profile.address,
    heading: s.monthlyReportTitle,
    monthLabel: formatMonth(report.month, lang),
    periodLabel: `${formatDate(report.periodStart, lang)} – ${formatDate(
      report.periodEnd,
      lang,
    )}`,
    rows: report.holders.map((holder, index) => ({
      sr: index + 1,
      name: holderName(holder.name, holder.nameEn, lang),
      accountNo: holder.accountNo,
      days: holder.days,
      total: holder.total,
      commission: holder.commission,
    })),
    total: report.total,
    commission: report.commission,
    agentName: profile.agentName,
    managerName: profile.managerName,
  }
  return buildMonthlyHtml(data, lang)
}

export function buildHolderStatementHtml(
  history: HolderHistory,
  profile: Profile,
  lang: Lang,
): string {
  const s = STRINGS[lang]
  const rows = [...history.entries].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const periodLabel =
    rows.length > 0
      ? `${formatDate(rows[0].date, lang)} – ${formatDate(
          rows[rows.length - 1].date,
          lang,
        )}`
      : formatDate(new Date().toISOString().slice(0, 10), lang)

  const data: StatementData = {
    societyName: profile.societyName,
    address: profile.address,
    heading: s.holderHistory,
    holderName: holderName(
      history.holder.name,
      history.holder.nameEn,
      lang,
    ),
    accountNo: history.holder.accountNo,
    phone: history.holder.phone,
    periodLabel,
    rows: rows.map((entry, index) => ({
      sr: index + 1,
      dateIso: entry.date,
      receiptNo: entry.receiptNo,
      amount: entry.amount,
    })),
    total: history.total,
    agentName: profile.agentName,
    managerName: profile.managerName,
  }
  return buildStatementHtml(data, lang)
}

const PRINT_STYLE = `
  @page { size: A4; margin: 0; }
  @media screen {
    html { background: #e5e7eb; }
    body {
      background: #fff;
      max-width: 210mm;
      min-height: 100vh;
      margin: 0 auto;
      padding: 18mm 16mm 18mm 22mm;
      box-shadow: 0 0 26px rgba(0,0,0,.18);
    }
    .accent { border-radius: 0; }
  }
  @media print {
    html, body { margin: 0; }
    body {
      padding: 18mm 16mm 18mm 22mm;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
  }
`

/**
 * Opens the browser print preview. Setting the page margin to zero and applying
 * the margins as body padding prevents browsers from printing their own
 * headers/footers (URL, date, time and page number) on the sheet.
 */
export function openPrintPreview(html: string): boolean {
  const previewHtml = html.replace(
    '</head>',
    `<style>${PRINT_STYLE}</style></head>`,
  )
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(previewHtml)
  win.document.close()
  win.document.title = 'Collection Summary'
  window.setTimeout(() => win.print(), 700)
  return true
}

export async function generateNativePdf(
  html: string,
  fileName: string,
): Promise<PdfGeneratorResult> {
  return PdfGenerator.generate({ html, fileName })
}

export function canSharePdf(): boolean {
  return Capacitor.isNativePlatform()
}

export async function sharePdf(
  result: PdfGeneratorResult,
  title: string,
  text: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await Share.share({
    title,
    text,
    url: result.uri,
    dialogTitle: title,
  })
}
