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

describe('Today calendar', () => {
  it('shows the week with the number of lessons per day', () => {
    renderApp('/', seed, { now: NOW })
    const cal = screen.getByRole('region', { name: 'الجدول' })
    expect(within(cal).getByRole('button', { name: /٢٧ نوفمبر: ١ حصة/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(cal).getByRole('button', { name: /٢٢ نوفمبر: لا حصص/ })).toBeInTheDocument()
  })

  it("opens another day's lessons, with attendance only for days that came", async () => {
    renderApp('/', seed, { now: NOW })
    const cal = screen.getByRole('region', { name: 'الجدول' })

    await userEvent.click(within(cal).getByRole('button', { name: /٢٦ نوفمبر/ }))
    const yesterday = screen.getByRole('list', { name: /حصص .*٢٦ نوفمبر/ })
    expect(yesterday).toHaveTextContent('عمر')
    expect(within(yesterday).getByRole('button', { name: 'عمر: حضر' })).toBeInTheDocument()
    expect(screen.queryByText('حصص اليوم')).not.toBeInTheDocument() // stats are for today only
  })

  it('moves to next week and shows upcoming lessons without attendance buttons', async () => {
    renderApp('/', seed, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'الأسبوع التالي' }))
    // Selected day jumps a week ahead: Friday 4 Dec.
    expect(screen.getByRole('list', { name: /حصص .*٤ ديسمبر/ })).toHaveTextContent('يوسف')
    expect(screen.queryByRole('button', { name: 'يوسف: حضر' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'النهارده' }))
    expect(screen.getByRole('list', { name: 'حصص اليوم' })).toBeInTheDocument()
  })

  it('unfolds into the whole month and picks a day from it', async () => {
    renderApp('/', seed, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'الشهر' }))
    const cal = screen.getByRole('region', { name: 'الجدول' })
    expect(within(cal).getAllByRole('button', { name: /نوفمبر/ }).length).toBeGreaterThanOrEqual(30)
    await userEvent.click(within(cal).getByRole('button', { name: /١٤ نوفمبر/ }))
    expect(screen.getByRole('list', { name: /حصص .*١٤ نوفمبر/ })).toHaveTextContent('عمر')
    expect(screen.getByRole('button', { name: 'الشهر' })).toBeInTheDocument() // folded back to the week
  })
})
