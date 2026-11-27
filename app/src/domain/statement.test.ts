import { describe, expect, it } from 'vitest'
import type { PayerDues } from './dues'
import { money, statementCsv, statementText } from './statement'

const p: PayerDues = {
  key: 'a1',
  name: 'الفرقان',
  kind: 'academy',
  currency: 'ريال',
  total: 125,
  lines: [
    { studentId: 's1', name: 'يوسف', mode: 'session', rate: 40, lessons: 2, minutes: 60, amount: 80 },
    { studentId: 's2', name: 'عمر', mode: 'hour', rate: 30, lessons: 3, minutes: 90, amount: 45 },
  ],
}

describe('statement', () => {
  it('formats money in Arabic digits with a decimal comma', () => {
    expect(money(12.5, 'ريال')).toBe('١٢٫٥ ريال')
  })

  it('writes a WhatsApp-ready statement', () => {
    expect(statementText(p, 'نوفمبر ٢٠٢٦')).toBe(
      ['كشف حساب: الفرقان', 'نوفمبر ٢٠٢٦', '', '• يوسف: ٢ حصص = ٨٠ ريال', '• عمر: ١٫٥ ساعة = ٤٥ ريال', '', 'الإجمالي: ١٢٥ ريال'].join(
        '\n',
      ),
    )
  })

  it('exports a CSV with a BOM, one row per student and a total row', () => {
    const csv = statementCsv(p, '2026-11')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const rows = csv.slice(1).split('\r\n')
    expect(rows).toHaveLength(4)
    expect(rows[1]).toBe('2026-11,الفرقان,يوسف,بالحصة,40,2,60,80,ريال')
    expect(rows[3]).toBe('2026-11,الفرقان,الإجمالي,,,5,150,125,ريال')
  })
})
