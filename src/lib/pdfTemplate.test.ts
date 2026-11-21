import { describe, expect, it } from 'vitest'
import {
  buildSheetHtml,
  buildStatementHtml,
  type SheetData,
  type StatementData,
} from './pdfTemplate'

const sheet: SheetData = {
  societyName: 'Society',
  address: 'Address',
  heading: 'Heading',
  dateIso: '2026-11-01',
  rows: [
    { sr: 1, name: 'RAMESH', accountNo: '001', receiptNo: 7, amount: 100 },
  ],
  denominations: [],
  agentName: 'Agent',
  managerName: 'Manager',
}

const statement: StatementData = {
  societyName: 'Society',
  address: 'Address',
  heading: 'Heading',
  holderName: 'RAMESH',
  accountNo: '001',
  phone: null,
  periodLabel: 'Period',
  rows: [{ sr: 1, dateIso: '2026-11-01', receiptNo: 7, amount: 100 }],
  total: 100,
  agentName: 'Agent',
  managerName: 'Manager',
}

describe('pdf templates', () => {
  it('includes receipt columns by default', () => {
    const html = buildSheetHtml(sheet, 'en')
    expect(html).toContain('Receipt No.')
    expect(html).toContain('colspan="4"')
  })

  it('drops receipt columns from the daily sheet when disabled', () => {
    const html = buildSheetHtml(sheet, 'en', false)
    expect(html).not.toContain('Receipt No.')
    expect(html).toContain('colspan="3"')
  })

  it('drops receipt columns from the statement when disabled', () => {
    const html = buildStatementHtml(statement, 'en', false)
    expect(html).not.toContain('Receipt No.')
    expect(html).toContain('colspan="2"')
  })

  it('shows the weekday with the date on the first page only', () => {
    const html = buildSheetHtml(sheet, 'en')
    // 2026-11-01 is a Sunday and is highlighted.
    expect(html).toContain('class="weekday sunday"')
    expect(html.match(/Sunday/g)).toHaveLength(1)
    // The continuation ("running") header keeps only society and address, so
    // the heading and the date appear once, on the first page.
    expect(html).toContain('class="running"')
    expect(html.match(/Heading/g)).toHaveLength(1)
  })

  it('marks Sundays in the statement rows', () => {
    const html = buildStatementHtml(statement, 'en', true)
    expect(html).toContain('class="weekday sunday"')
    expect(html).toContain('Sun</span> 01 November 2026')
  })
})
