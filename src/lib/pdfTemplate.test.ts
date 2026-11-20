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
})
