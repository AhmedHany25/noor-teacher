import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../domain/attendance'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1, guardianPhone: '01012345678' }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 }

const group: Group = {
  id: 'g1',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '09:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
}

const ses = (date: string, status: 'p' | 'a', notes?: Session['notes']): Session => ({
  id: `g1_${date}`,
  groupId: 'g1',
  date,
  time: '09:00',
  kind: 'regular',
  attendance: { s1: { status, billable: true } },
  notes,
  updatedAt: 1,
})

const sessions = [
  ses('2026-11-06', 'p', { s1: { memorized: { from: { s: 78, a: 1 }, to: { s: 78, a: 10 } }, rating: 'good', mistakes: [{ s: 78, a: 7, type: 'hifz' }] } }),
  ses('2026-11-13', 'a'),
  ses('2026-11-20', 'p', { s1: { memorized: { from: { s: 78, a: 11 }, to: { s: 78, a: 20 } }, homework: 'حفظ النبأ ٢١–٣٠', mistakes: [{ s: 78, a: 7, type: 'hifz' }] } }),
]

const NOW = new Date(2026, 10, 27, 12, 0)
const seed = { students: [yusuf, omar], groups: [group], sessions }

describe('Student file', () => {
  it('opens from the list and shows progress at a glance', async () => {
    renderApp('/students', seed, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: /^يوسف/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'يوسف' })).toBeInTheDocument()

    const stats = screen.getByRole('region', { name: 'تقدّم يوسف' })
    expect(stats).toHaveTextContent('٢٠') // ayat this month
    expect(stats).toHaveTextContent('٦٧٪') // 2 of 3 attended
    expect(stats).toHaveTextContent('النبأ ٢٠') // where they stopped
  })

  it('shows the current homework, repeated mistakes and recent lessons', () => {
    renderApp('/students/s1', seed, { now: NOW })
    expect(screen.getByRole('region', { name: 'الواجب الحالي' })).toHaveTextContent('حفظ النبأ ٢١–٣٠')
    expect(screen.getByRole('region', { name: 'مواضع تحتاج مراجعة' })).toHaveTextContent('النبأ ٧')
    const recent = within(screen.getByRole('region', { name: 'آخر الحصص' })).getAllByRole('listitem')
    expect(recent[0]).toHaveTextContent('النبأ ١١–٢٠')
    expect(within(recent[0]).getByRole('link')).toHaveAttribute('href', '/lessons/g1/2026-11-20')
    expect(recent[1]).toHaveTextContent('غاب')
  })

  it('edits the student from the file', async () => {
    const { repos } = renderApp('/students/s1', seed, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: 'تعديل البيانات' }))
    const name = screen.getByLabelText('الاسم')
    await userEvent.clear(name)
    await userEvent.type(name, 'يوسف محمود')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.students.all().find((s) => s.id === 's1')?.name).toBe('يوسف محمود')
    expect(screen.getByRole('heading', { level: 1, name: 'يوسف محمود' })).toBeInTheDocument()
  })
})

describe('Monthly reports', () => {
  it('prepares a report per active student and marks it sent', async () => {
    const { repos } = renderApp('/reports', seed, { now: NOW })
    expect(screen.getByRole('heading', { level: 2, name: 'نوفمبر ٢٠٢٦' })).toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'تقرير يوسف' })
    const text = within(card).getByLabelText('نص التقرير') as HTMLTextAreaElement
    expect(text.value).toContain('التقرير الشهري لـيوسف، نوفمبر ٢٠٢٦')
    expect(text.value).toContain('📖 الحفظ الجديد: ٢٠ آية')

    const link = within(card).getByRole('link', { name: 'إرسال على واتساب' })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/)
    await userEvent.click(link)
    expect(repos.students.all().find((s) => s.id === 's1')?.reportsSent?.['2026-11']).toBeTypeOf('number')
    expect(card).toHaveTextContent('اتبعت')
    expect(screen.getByRole('region', { name: 'تقرير عمر' })).not.toHaveTextContent('اتبعت')
  })

  it('is reachable from the students screen', async () => {
    renderApp('/students', seed, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: 'التقارير الشهرية' }))
    expect(screen.getByRole('heading', { level: 1, name: 'التقارير الشهرية' })).toBeInTheDocument()
  })
})
