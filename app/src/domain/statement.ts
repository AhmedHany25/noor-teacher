import type { PayerDues } from './dues'

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number | string) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)]).replace('.', '٫')

export function money(n: number, currency: string): string {
  return `${ar(Math.round(n * 100) / 100)} ${currency}`
}

function hours(minutes: number): string {
  const h = Math.round((minutes / 60) * 100) / 100
  return `${ar(h)} ساعة`
}

function lineDetail(l: PayerDues['lines'][number]): string {
  if (l.mode === 'hour') return hours(l.minutes)
  if (l.mode === 'month') return 'شهري'
  return `${ar(l.lessons)} ${l.lessons === 1 ? 'حصة' : l.lessons <= 10 ? 'حصص' : 'حصة'}`
}

/** Plain-text monthly statement, ready to paste into WhatsApp. */
export function statementText(p: PayerDues, monthLabel: string): string {
  const lines = [
    `كشف حساب: ${p.name}`,
    monthLabel,
    '',
    ...p.lines.map((l) => `• ${l.name}: ${lineDetail(l)} = ${money(l.amount, p.currency)}`),
    '',
    `الإجمالي: ${money(p.total, p.currency)}`,
  ]
  return lines.join('\n')
}

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV with a BOM so Excel opens Arabic text correctly. */
export function statementCsv(p: PayerDues, month: string): string {
  const rows: (string | number)[][] = [
    ['الشهر', 'الجهة', 'الطالب', 'طريقة الحساب', 'السعر', 'عدد الحصص', 'الدقائق', 'المستحق', 'العملة'],
    ...p.lines.map((l) => [month, p.name, l.name, { session: 'بالحصة', hour: 'بالساعة', month: 'بالشهر' }[l.mode], l.rate, l.lessons, l.minutes, l.amount, p.currency]),
    [month, p.name, 'الإجمالي', '', '', p.lines.reduce((a, l) => a + l.lessons, 0), p.lines.reduce((a, l) => a + l.minutes, 0), p.total, p.currency],
  ]
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}
