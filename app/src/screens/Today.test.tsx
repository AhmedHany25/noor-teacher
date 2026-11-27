import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Group } from '../domain/schedule'
import type { Student } from '../domain/student'
import { renderApp } from '../test/renderApp'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 }

const group = (over: Partial<Group>): Group => ({
  id: 'g',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

// Friday 27 Nov 2026, noon. Saturday 28 is tomorrow; Thursday 26 was yesterday.
const NOW = new Date(2026, 10, 27, 12, 0)
const seed = {
  students: [yusuf, omar],
  groups: [
    group({ id: 'fri', studentIds: ['s1'], slots: [{ weekday: 5, time: '17:00' }] }),
    group({ id: 'sat', studentIds: ['s2'], slots: [{ weekday: 6, time: '10:00' }] }),
    group({ id: 'thu', studentIds: ['s2'], slots: [{ weekday: 4, time: '09:00' }] }),
  ],
}

describe('Month-end reminder', () => {
  it('points to the monthly reports in the last days of the month', async () => {
    renderApp('/', seed, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: /التقارير الشهرية لـنوفمبر ٢٠٢٦ جاهزة/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'التقارير الشهرية' })).toBeInTheDocument()
  })

  it('stays quiet earlier in the month', () => {
    renderApp('/', seed, { now: new Date(2026, 10, 10, 12, 0) })
    expect(screen.queryByRole('link', { name: /التقارير الشهرية/ })).not.toBeInTheDocument()
  })
})

describe('Today', () => {
  it("shows only today's lessons as compact cards that open the attendance page", () => {
    renderApp('/', seed, { now: NOW })
    expect(screen.queryByRole('region', { name: 'الجدول' })).not.toBeInTheDocument()
    const items = within(screen.getByRole('list', { name: 'حصص اليوم' })).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('يوسف')
    expect(within(items[0]).getByRole('link', { name: /يوسف/ })).toHaveAttribute('href', '/attendance?date=2026-11-27&focus=fri')
    expect(screen.queryByRole('button', { name: 'يوسف: حضر' })).not.toBeInTheDocument()
  })
})

describe('Student reminders on Today', () => {
  it('lists reminders required by the academy and opens WhatsApp with the message', async () => {
    const academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session' as const, rate: 40, archived: false, remindHours: 4 }
    const { repos } = renderApp(
      '/',
      { ...seed, academies: [academy], students: [{ ...yusuf, academyId: 'a1', guardianPhone: '01012345678' }, omar] },
      { now: NOW },
    )
    const card = screen.getByRole('region', { name: 'تذكيرات الطلاب' })
    expect(card).toHaveTextContent('يوسف')
    // Lesson at 5 pm, reminder 4 hours before: 1 pm. The test clock is noon.
    expect(card).toHaveTextContent('تذكّره الساعة ١:٠٠ م')
    const link = within(card).getByRole('link', { name: 'ذكّر يوسف' })
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('تذكير بحصة يوسف اليوم الساعة ٥:٠٠ م')
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/)
    await userEvent.click(link)
    expect(repos.reminderMarks.all().map((m) => m.id)).toEqual(['fri:2026-11-27:17:00:s1'])
    expect(card).toHaveTextContent('اتبعت ✓')
  })

  it('stays hidden when no academy asks for reminders', () => {
    renderApp('/', seed, { now: NOW })
    expect(screen.queryByRole('region', { name: 'تذكيرات الطلاب' })).not.toBeInTheDocument()
  })
})

describe('Attendance page calendar', () => {
  it('shows the week with the number of lessons per day', () => {
    renderApp('/attendance', seed, { now: NOW })
    const cal = screen.getByRole('region', { name: 'الجدول' })
    expect(within(cal).getByRole('button', { name: /٢٧ نوفمبر: ١ حصة/ })).toBeInTheDocument()
    expect(within(cal).getByRole('button', { name: /٢٢ نوفمبر: لا حصص/ })).toBeInTheDocument()
  })

  it("opens a day's lessons, with attendance only for days that came", async () => {
    renderApp('/attendance', seed, { now: NOW })
    const cal = screen.getByRole('region', { name: 'الجدول' })
    await userEvent.click(within(cal).getByRole('button', { name: /٢٦ نوفمبر/ }))
    const yesterday = screen.getByRole('list', { name: /حصص .*٢٦ نوفمبر/ })
    expect(yesterday).toHaveTextContent('عمر')
    expect(within(yesterday).getByRole('button', { name: 'عمر: حضر' })).toBeInTheDocument()
  })

  it('shows upcoming lessons without attendance buttons', async () => {
    renderApp('/attendance', seed, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'الأسبوع التالي' }))
    expect(screen.getByRole('list', { name: /حصص .*٤ ديسمبر/ })).toHaveTextContent('يوسف')
    expect(screen.queryByRole('button', { name: 'يوسف: حضر' })).not.toBeInTheDocument()
  })

  it('highlights the lesson the teacher came for from Today', () => {
    renderApp('/attendance?date=2026-11-27&focus=fri', seed, { now: NOW })
    const items = within(screen.getByRole('list', { name: /حصص .*٢٧ نوفمبر/ })).getAllByRole('listitem')
    expect(items[0]).toHaveClass('is-focus')
    expect(within(items[0]).getByRole('link', { name: 'تفاصيل حصة يوسف' })).toHaveAttribute('href', '/lessons/fri/2026-11-27')
  })

  it('filters by student and counts per state', async () => {
    renderApp('/attendance', seed, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'الشهر ده' }))
    await userEvent.selectOptions(screen.getByLabelText('الطالب'), 's2')
    const region = screen.getByRole('region', { name: 'الحصص' })
    expect(region).not.toHaveTextContent('يوسف')
    expect(screen.getByRole('button', { name: /^الكل/ })).toHaveTextContent('٨') // omar: 4 Thursdays + 4 Saturdays in November
  })
})
