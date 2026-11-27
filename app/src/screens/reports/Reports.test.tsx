import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Academy } from '../../domain/academy'
import type { Session } from '../../domain/attendance'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const furqan: Academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }
const students: Student[] = [
  { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 },
  { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1, rate: 100 },
]
const group = (id: string, sid: string): Group => ({
  id,
  studentIds: [sid],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
})
const ses = (g: string, sid: string, date: string, status: 'p' | 'a'): Session => ({
  id: `${g}_${date}`,
  groupId: g,
  date,
  time: '17:00',
  kind: 'regular',
  attendance: { [sid]: { status, billable: true } },
  updatedAt: 1,
})
const seed = {
  academies: [furqan],
  students,
  groups: [group('g1', 's1'), group('g2', 's2')],
  sessions: [ses('g1', 's1', '2026-11-06', 'p'), ses('g1', 's1', '2026-11-13', 'a'), ses('g2', 's2', '2026-11-06', 'p')],
  payments: [{ id: 'p1', payerKey: 'a1', amount: 40, currency: 'ريال', date: '2026-11-15', resetsCycle: true }],
}
const NOW = new Date(2026, 10, 27, 12, 0)

describe('Reports', () => {
  it('offers four kinds of report', async () => {
    renderApp('/reports', seed, { now: NOW })
    const kinds = within(screen.getByRole('list', { name: 'أنواع التقارير' })).getAllByRole('link')
    expect(kinds.map((k) => k.getAttribute('href'))).toEqual(['/reports/parents', '/reports/academies', '/reports/attendance', '/reports/summary'])
  })

  it("shows each academy's statement with WhatsApp and Excel", () => {
    renderApp('/reports/academies', seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'كشف الفرقان' })
    expect(card).toHaveTextContent('٨٠ ريال')
    expect(decodeURIComponent(within(card).getByRole('link', { name: 'إرسال الكشف واتساب' }).getAttribute('href')!)).toContain('كشف حساب: الفرقان')
    expect(screen.queryByRole('region', { name: 'كشف عمر' })).not.toBeInTheDocument()
  })

  it('reports attendance per student for the month and filters by payer', async () => {
    renderApp('/reports/attendance', seed, { now: NOW })
    const rows = within(screen.getByRole('table', { name: 'حضور الطلاب' })).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('عمر')
    expect(rows[2]).toHaveTextContent('يوسف')
    expect(rows[2]).toHaveTextContent('٥٠٪')
    await userEvent.selectOptions(screen.getByLabelText('الجهة'), 'a1')
    expect(within(screen.getByRole('table', { name: 'حضور الطلاب' })).getAllByRole('row')).toHaveLength(2)
  })

  it("summarises the teacher's month", () => {
    renderApp('/reports/summary', seed, { now: NOW })
    expect(screen.getByRole('region', { name: 'أرقام الشهر' })).toHaveTextContent('٢')
    const money = screen.getByRole('region', { name: 'الفلوس' })
    expect(money).toHaveTextContent('٨٠ ريال')
    expect(money).toHaveTextContent('١٠٠ جنيه')
    expect(money).toHaveTextContent('٤٠ ريال')
  })
})
