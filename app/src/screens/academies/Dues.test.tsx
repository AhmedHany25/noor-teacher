import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Academy } from '../../domain/academy'
import type { Session } from '../../domain/attendance'
import type { Payment } from '../../domain/dues'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const furqan: Academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }
const yusuf: Student = { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 }
const sara: Student = { id: 's2', name: 'سارة', academyId: null, status: 'active', createdAt: 1, payMode: 'month', rate: 600 }
const g = (id: string, sid: string): Group => ({
  id,
  studentIds: [sid],
  startDate: '2026-10-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
})
const ses = (groupId: string, sid: string, date: string): Session => ({
  id: `${groupId}_${date}`,
  groupId,
  date,
  time: '17:00',
  kind: 'regular',
  attendance: { [sid]: { status: 'p', billable: true } },
  updatedAt: 1,
})

const seed = {
  academies: [furqan],
  students: [yusuf, sara],
  groups: [g('g1', 's1'), g('g2', 's2')],
  sessions: [
    ses('g1', 's1', '2026-10-30'),
    ses('g1', 's1', '2026-11-06'),
    ses('g1', 's1', '2026-11-13'),
    ses('g2', 's2', '2026-11-06'),
  ],
}
const NOW = new Date(2026, 10, 27, 12, 0)

describe('Dues screen', () => {
  it("shows this month's dues per payer with a per-student breakdown", () => {
    renderApp('/academies', seed, { now: NOW })
    expect(screen.getByRole('heading', { level: 2, name: 'نوفمبر ٢٠٢٦' })).toBeInTheDocument()
    const furqanCard = screen.getByRole('region', { name: 'الفرقان' })
    expect(furqanCard).toHaveTextContent('٨٠ ريال')
    expect(furqanCard).toHaveTextContent('يوسف')
    expect(furqanCard).toHaveTextContent('٢ حصص')
    const saraCard = screen.getByRole('region', { name: 'سارة' })
    expect(saraCard).toHaveTextContent('٦٠٠ جنيه')
    expect(saraCard).toHaveTextContent('خصوصي')
  })

  it('shows totals per currency for the month', () => {
    renderApp('/academies', seed, { now: NOW })
    const totals = screen.getByRole('list', { name: 'إجمالي الشهر' })
    expect(totals).toHaveTextContent('٨٠ ريال')
    expect(totals).toHaveTextContent('٦٠٠ جنيه')
  })

  it('moves between months', async () => {
    renderApp('/academies', seed, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'الشهر السابق' }))
    expect(screen.getByRole('heading', { level: 2, name: 'أكتوبر ٢٠٢٦' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'الفرقان' })).toHaveTextContent('٤٠ ريال')
    expect(screen.queryByRole('region', { name: 'سارة' })).not.toBeInTheDocument()
  })

  it('shows what is still owed overall, after payments', () => {
    const paid: Payment = { id: 'p1', payerKey: 'a1', amount: 40, currency: 'ريال', date: '2026-10-31', resetsCycle: true }
    renderApp('/academies', { ...seed, payments: [paid] }, { now: NOW })
    expect(screen.getByRole('region', { name: 'الفرقان' })).toHaveTextContent('المتبقي ليك: ٨٠ ريال')
  })

  it('shows the lesson cycle counter for academy students', () => {
    const paid: Payment = { id: 'p1', payerKey: 'a1', amount: 40, currency: 'ريال', date: '2026-10-31', resetsCycle: true }
    renderApp('/academies', { ...seed, payments: [paid] }, { now: NOW })
    expect(screen.getByRole('region', { name: 'الفرقان' })).toHaveTextContent('الدورة: ٢ من ٨')
  })

  it('records a received payment prefilled with the outstanding amount', async () => {
    const { repos } = renderApp('/academies', seed, { now: NOW })
    await userEvent.click(within(screen.getByRole('region', { name: 'الفرقان' })).getByRole('link', { name: 'تسجيل مبلغ مستلم' }))
    expect(screen.getByLabelText('المبلغ')).toHaveValue('120')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.payments.all()).toMatchObject([
      { payerKey: 'a1', amount: 120, currency: 'ريال', date: '2026-11-27', resetsCycle: true },
    ])
    expect(screen.getByRole('status')).toHaveTextContent('تم تسجيل المبلغ')
    expect(screen.getByRole('region', { name: 'الفرقان' })).toHaveTextContent('المتبقي ليك: ٠ ريال')
  })

  it('offers sharing the statement and downloading it', () => {
    renderApp('/academies', seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'الفرقان' })
    const wa = within(card).getByRole('link', { name: 'إرسال الكشف واتساب' })
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain('كشف حساب: الفرقان')
    expect(within(card).getByRole('button', { name: 'تحميل Excel' })).toBeInTheDocument()
  })

  it('keeps academy management on the same screen', () => {
    renderApp('/academies', seed, { now: NOW })
    expect(within(screen.getByRole('list', { name: 'الأكاديميات' })).getByRole('link', { name: /الفرقان/ })).toHaveAttribute(
      'href',
      '/academies/a1',
    )
  })
})
