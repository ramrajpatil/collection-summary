import { STRINGS, type Lang } from './i18n'
import {
  formatDate,
  formatDigits,
  formatReceipt,
  formatRupees,
} from './marathi'

export interface SheetRow {
  sr: number
  name: string
  accountNo: string
  receiptNo: number
  amount: number
}

export interface DenominationCount {
  value: number
  count: number
}

export interface SheetData {
  societyName: string
  address: string
  heading: string
  dateIso: string
  rows: SheetRow[]
  denominations: DenominationCount[]
  agentName: string
  managerName: string
}

export interface MonthlySheetRow {
  sr: number
  name: string
  accountNo: string
  days: number
  total: number
  commission: number
}

export interface MonthlySheetData {
  societyName: string
  address: string
  heading: string
  monthLabel: string
  periodLabel: string
  rows: MonthlySheetRow[]
  total: number
  commission: number
  agentName: string
  managerName: string
}

export interface StatementRow {
  sr: number
  dateIso: string
  receiptNo: number
  amount: number
}

export interface StatementData {
  societyName: string
  address: string
  heading: string
  holderName: string
  accountNo: string
  phone: string | null
  periodLabel: string
  rows: StatementRow[]
  total: number
  agentName: string
  managerName: string
}

const DENOM_VALUES = [500, 200, 100, 50, 20, 10, 5]

export function computeDenominations(total: number): DenominationCount[] {
  let remaining = Math.max(0, Math.round(total))
  return DENOM_VALUES.map((value) => {
    const count = Math.floor(remaining / value)
    remaining -= count * value
    return { value, count }
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Column {
  label: string
  width: string
  align?: 'c' | 'r'
}

function colgroupHtml(columns: Column[]): string {
  const cols = columns
    .map((column) =>
      column.width ? `<col style="width: ${column.width}" />` : `<col />`,
    )
    .join('')
  return `<colgroup>${cols}</colgroup>`
}

function theadHtml(columns: Column[]): string {
  const cells = columns
    .map(
      (column) =>
        `<th${column.align ? ` class="${column.align}"` : ''}>${column.label}</th>`,
    )
    .join('')
  return `<thead><tr>${cells}</tr></thead>`
}

function headerBlockHtml(
  societyName: string,
  address: string,
  heading: string,
  right: string,
): string {
  return `<header class="head">
    <div class="society">${escapeHtml(societyName)}</div>
    <div class="address">${escapeHtml(address)}</div>
    <div class="meta">
      <div class="heading">${escapeHtml(heading)}</div>
      <div class="date">${right}</div>
    </div>
  </header>`
}

function runningBlockHtml(
  headerHtml: string,
  columns: Column[],
  periodHtml = '',
): string {
  return `<div class="running">
    ${headerHtml}
    <div class="divider"></div>
    ${periodHtml}
    <table class="running-table">${colgroupHtml(columns)}${theadHtml(columns)}</table>
  </div>`
}

const SHEET_CSS = `
  @font-face {
    font-family: 'NotoDev';
    src: url('fonts/NotoSansDevanagari-Regular.ttf') format('truetype');
    font-weight: 400;
  }
  @font-face {
    font-family: 'NotoDev';
    src: url('fonts/NotoSansDevanagari-Bold.ttf') format('truetype');
    font-weight: 700;
  }
  @page { size: A4; margin: 10.8mm 16mm 18mm 22mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'NotoDev', 'Noto Sans Devanagari', sans-serif;
    color: #101114;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .accent {
    height: 3mm;
    border-radius: 2mm;
    background: linear-gradient(90deg, #2f6bff, #8b5cf6, #14b8a6);
    margin-bottom: 5mm;
  }
  .head { text-align: center; }
  .society { font-size: 19pt; font-weight: 700; letter-spacing: 0.2pt; }
  .address { font-size: 9.5pt; color: #4b5563; margin-top: 1.5mm; }
  .divider { height: 0.4mm; background: #111827; margin: 3mm 0 2.5mm; }
  .meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4mm;
    margin: 2.5mm 0 0;
  }
  .heading { font-size: 12.5pt; font-weight: 700; }
  .date { font-size: 10.5pt; white-space: nowrap; flex-shrink: 0; }
  .period {
    display: flex;
    justify-content: space-between;
    gap: 4mm;
    margin: 0 0 2.5mm;
    font-size: 9.5pt;
    color: #374151;
  }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: #eef2ff;
    border: 0.35mm solid #1f2937;
    padding: 1.2mm 1.6mm;
    font-size: 10pt;
    font-weight: 700;
    text-align: left;
  }
  tbody td {
    border: 0.3mm solid #6b7280;
    padding: 1mm 1.6mm;
    font-size: 10pt;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .c { text-align: center; }
  .r { text-align: right; white-space: nowrap; }
  tfoot td {
    border: 0.35mm solid #1f2937;
    padding: 1.4mm 1.6mm;
    font-size: 11pt;
    font-weight: 700;
    background: #eef2ff;
  }
  .running { display: none; }
  body.continued .running {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #fff;
    z-index: 20;
  }
  .running-table { width: 100%; border-collapse: collapse; }
  .notes { margin-top: 3mm; page-break-inside: avoid; }
  .notes-title { font-size: 10pt; font-weight: 700; margin-bottom: 1.5mm; }
  .notes-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5mm;
    width: 100%;
  }
  .note {
    border: 0.3mm solid #6b7280;
    border-radius: 1.5mm;
    padding: 1.5mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 20mm;
  }
  .note-label {
    font-weight: 700;
    font-size: 9pt;
    margin-bottom: 0;
  }
  .note-count {
    font-size: 10pt;
    margin: 0;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 0 0 0.4mm 2mm;
    gap: 1mm;
  }
  .note-count .write-line {
    flex: 1;
    border-bottom: 0.3mm solid #6b7280;
    min-height: 2mm;
    margin-bottom: -0.4mm;
  }
  .note-amount {
    font-size: 9pt;
    color: #374151;
    margin-top: 0;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 0.4mm 0 0.4mm 2mm;
    gap: 1mm;
  }
  .note-amount .write-line {
    flex: 1;
    border-bottom: 0.3mm solid #6b7280;
    min-height: 8mm;
    margin-bottom: -0.4mm;
  }
  .notes-total {
    margin-top: 2mm;
    text-align: right;
    font-size: 10.5pt;
    font-weight: 700;
  }
  .summary {
    margin-top: 4mm;
    display: flex;
    justify-content: flex-end;
    gap: 8mm;
    font-size: 10.5pt;
    font-weight: 700;
  }
  .summary span { color: #374151; font-weight: 400; }
  .signs {
    display: flex;
    justify-content: space-between;
    gap: 12mm;
    margin-top: 8mm;
    page-break-inside: avoid;
  }
  .sign {
    flex: 1;
    text-align: center;
  }
  .extra-top-height {
    height-top: 20mm;
  }
  .sign-line {
    border-top: 0.35mm solid #111827;
    margin-top: 16mm;
    padding-top: 1.5mm;
    font-size: 9.5pt;
  }
  .sign-name { font-size: 9pt; color: #4b5563; }
`

export function buildSheetHtml(data: SheetData, lang: Lang = 'mr'): string {
  const s = STRINGS[lang]
  const total = data.rows.reduce((sum, row) => sum + row.amount, 0)

  const rowsHtml = data.rows
    .map(
      (row) => `
        <tr>
          <td class="c">${formatDigits(row.sr, lang)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td class="c">${formatReceipt(row.receiptNo, lang)}</td>
          <td class="c">${formatDigits(escapeHtml(row.accountNo), lang)}</td>
          <td class="r">${formatRupees(row.amount, lang)}</td>
        </tr>`,
    )
    .join('')

  const filteredDenominations = data.denominations.filter(
    d => ![20, 10, 5].includes(d.value)
  )

  const notesHtml = filteredDenominations
    .map(
      (d) => `
        <div class="note"><div class="note-label">${formatRupees(d.value, lang)}</div><div class="note-count">×<span></span></div><div class="note-amount">₹<span class="write-line"></span></div></div>`,
    )
    .join('')

  const columns: Column[] = [
    { label: s.srNo, width: '13mm', align: 'c' },
    { label: s.name, width: '' },
    { label: s.receiptNo, width: '28mm', align: 'c' },
    { label: s.accountNo, width: '26mm', align: 'c' },
    { label: s.amount, width: '27mm', align: 'r' },
  ]
  const dateHtml = `${s.dateLabel}: ${formatDate(data.dateIso, lang)}`
  const headerHtml = headerBlockHtml(
    data.societyName,
    data.address,
    data.heading,
    dateHtml,
  )
  const runningHtml = runningBlockHtml(headerHtml, columns)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>${SHEET_CSS}</style>
</head>
<body>
  ${runningHtml}
  <div class="accent"></div>
  ${headerHtml}
  <div class="divider"></div>
  <table>
    ${colgroupHtml(columns)}
    ${theadHtml(columns)}
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${s.totalCollection} (${formatDigits(data.rows.length, lang)} ${s.accounts})</td>
        <td class="r">${formatRupees(total, lang)}</td>
      </tr>
    </tfoot>
  </table>
  <section class="notes">
    <div class="notes-title">${s.notesDetail}</div>
    <div class="notes-grid">${notesHtml}</div>
  </section>
  <section class="signs">
    <div class="sign">
      <div class="sign-line">${s.agentSign}</div>
      <div class="sign-name">${escapeHtml(data.agentName)}</div>
    </div>
    <div class="sign">
      <div class="sign-line">${s.managerSign}</div>
      <div class="sign-name">${escapeHtml(data.managerName)}</div>
    </div>
  </section>
</body>
</html>`
}

export function buildStatementHtml(
  data: StatementData,
  lang: Lang = 'mr',
): string {
  const s = STRINGS[lang]

  const rowsHtml = data.rows
    .map(
      (row) => `
        <tr>
          <td class="c">${formatDigits(row.sr, lang)}</td>
          <td class="c">${formatDate(row.dateIso, lang)}</td>
          <td class="c">${formatReceipt(row.receiptNo, lang)}</td>
          <td class="r">${formatRupees(row.amount, lang)}</td>
        </tr>`,
    )
    .join('')

  const columns: Column[] = [
    { label: s.srNo, width: '16mm', align: 'c' },
    { label: s.dateLabel, width: '', align: 'c' },
    { label: s.receiptNo, width: '32mm', align: 'c' },
    { label: s.amount, width: '34mm', align: 'r' },
  ]
  const headerHtml = headerBlockHtml(
    data.societyName,
    data.address,
    data.heading,
    `${s.period}: ${escapeHtml(data.periodLabel)}`,
  )
  const periodHtml = `<div class="period">
    <span>${s.holderName}: ${escapeHtml(data.holderName)}</span>
    <span>${s.accountNo}: ${formatDigits(escapeHtml(data.accountNo), lang)}${
      data.phone ? ` · ${s.holderPhone}: ${escapeHtml(data.phone)}` : ''
    }</span>
  </div>`
  const runningHtml = runningBlockHtml(headerHtml, columns, periodHtml)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>${SHEET_CSS}</style>
</head>
<body>
  ${runningHtml}
  <div class="accent"></div>
  ${headerHtml}
  <div class="divider"></div>
  ${periodHtml}
  <table>
    ${colgroupHtml(columns)}
    ${theadHtml(columns)}
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="3">${s.holderTotal} (${formatDigits(
          data.rows.length,
          lang,
        )} ${s.days})</td>
        <td class="r">${formatRupees(data.total, lang)}</td>
      </tr>
    </tfoot>
  </table>
  <section class="signs">
    <div class="sign">
      <div class="sign-line">${s.agentSign}</div>
      <div class="sign-name">${escapeHtml(data.agentName)}</div>
    </div>
    <div class="sign">
      <div class="sign-line">${s.managerSign}</div>
      <div class="sign-name">${escapeHtml(data.managerName)}</div>
    </div>
  </section>
</body>
</html>`
}

export function buildMonthlyHtml(
  data: MonthlySheetData,
  lang: Lang = 'mr',
): string {
  const s = STRINGS[lang]

  const rowsHtml = data.rows
    .map(
      (row) => `
        <tr>
          <td class="c">${formatDigits(row.sr, lang)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td class="c">${formatDigits(escapeHtml(row.accountNo), lang)}</td>
          <td class="c">${formatDigits(row.days, lang)}</td>
          <td class="r">${formatRupees(row.total, lang)}</td>
          <td class="r">${formatRupees(row.commission, lang)}</td>
        </tr>`,
    )
    .join('')

  const columns: Column[] = [
    { label: s.srNo, width: '13mm', align: 'c' },
    { label: s.name, width: '' },
    { label: s.accountNo, width: '26mm', align: 'c' },
    { label: s.days, width: '16mm', align: 'c' },
    { label: s.totalCollection, width: '30mm', align: 'r' },
    { label: s.commission, width: '30mm', align: 'r' },
  ]
  const headerHtml = headerBlockHtml(
    data.societyName,
    data.address,
    data.heading,
    escapeHtml(data.monthLabel),
  )
  const periodHtml = `<div class="period">
    <span>${s.period}: ${escapeHtml(data.periodLabel)}</span>
    <span>${s.commissionRate}</span>
  </div>`
  const runningHtml = runningBlockHtml(headerHtml, columns, periodHtml)

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>${SHEET_CSS}</style>
</head>
<body>
  ${runningHtml}
  <div class="accent"></div>
  ${headerHtml}
  <div class="divider"></div>
  ${periodHtml}
  <table>
    ${colgroupHtml(columns)}
    ${theadHtml(columns)}
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${s.monthlyTotal} (${formatDigits(data.rows.length, lang)} ${s.accounts})</td>
        <td class="r">${formatRupees(data.total, lang)}</td>
        <td class="r">${formatRupees(data.commission, lang)}</td>
      </tr>
    </tfoot>
  </table>
  <section class="signs extra-top-height">
    <div class="sign">
      <div class="sign-line">${s.agentSign}</div>
      <div class="sign-name">${escapeHtml(data.agentName)}</div>
    </div>
    <div class="sign">
      <div class="sign-line">${s.managerSign}</div>
      <div class="sign-name">${escapeHtml(data.managerName)}</div>
    </div>
  </section>
</body>
</html>`
}
