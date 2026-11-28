import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../domain/attendance'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'
import raw from '../../../public/quran.txt?raw'

beforeAll(() => {
  vi.stubGlobal('fetch', async () => new Response(raw))
})

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const group: Group = {
  id: 'g',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
}
const lesson = (date: string, over: Partial<Session> = {}): Session => ({
  id: `g_${date}`,
  groupId: 'g',
  date,
  time: '17:00',
  kind: 'regular',
  attendance: { s1: { status: 'p', billable: true } },
  updatedAt: 1,
  ...over,
})
const NOW = new Date(2026, 10, 27, 18, 0)

describe('Mushaf', () => {
  it('records a mistake with one tap using the chosen kind, and removes it with a second tap', async () => {
    const { repos } = renderApp(
      '/mushaf?session=g_2026-11-27&student=s1&s=112&a=1&to=4',
      { students: [yusuf], groups: [group], sessions: [lesson('2026-11-27')] },
      { now: NOW },
    )
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    expect(within(text).getAllByRole('button')).toHaveLength(15) // al-Ikhlas: 4 + 2 + 4 + 5 words
    await userEvent.click(within(text).getAllByRole('button')[2])
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toEqual([{ s: 112, a: 1, w: 2, type: 'hifz' }])

    await userEvent.click(screen.getByRole('radio', { name: 'تجويد' }))
    await userEvent.click(within(screen.getByRole('article')).getAllByRole('button')[5])
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toHaveLength(2)
    expect(screen.getByRole('radiogroup', { name: 'نوع الغلطة' })).toHaveTextContent('غلطات حصة النهارده: ٢')

    await userEvent.click(screen.getByRole('radio', { name: 'حفظ' }))
    await userEvent.click(within(screen.getByRole('article')).getAllByRole('button')[2])
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toEqual([{ s: 112, a: 2, w: 1, type: 'tajweed' }])
  })

  it("marks straight away during today's lesson, recording the student present", async () => {
    const { repos } = renderApp('/mushaf?student=s1&s=112', { students: [yusuf], groups: [group] }, { now: NOW })
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    await userEvent.click(within(text).getAllByRole('button')[0])
    expect(repos.sessions.all()[0]).toMatchObject({
      id: 'g_2026-11-27',
      attendance: { s1: { status: 'p' } },
      notes: { s1: { mistakes: [{ s: 112, a: 1, w: 0, type: 'hifz' }] } },
    })
    expect(screen.getByRole('status')).toHaveTextContent('اتسجل حضور يوسف')
  })

  it('without a lesson today, marks in the last lesson the student attended', async () => {
    const { repos } = renderApp(
      '/mushaf?student=s1&s=112',
      { students: [yusuf], groups: [{ ...group, slots: [{ weekday: 1, time: '17:00' }] }], sessions: [lesson('2026-11-23')] },
      { now: NOW },
    )
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    expect(screen.getByRole('radiogroup', { name: 'نوع الغلطة' })).toHaveTextContent('غلطات حصة الاثنين، ٢٣ نوفمبر')
    await userEvent.click(within(text).getAllByRole('button')[1])
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toEqual([{ s: 112, a: 1, w: 1, type: 'hifz' }])
  })

  it('turns pages through a long surah and on to the next one', async () => {
    renderApp('/mushaf?s=2', { students: [yusuf], groups: [group] }, { now: NOW })
    await screen.findByRole('article', { name: 'نص سورة البقرة' })
    expect(screen.getByText(/صفحة ١ من/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /التالية/ }))
    expect(screen.getByText(/صفحة ٢ من/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /السابقة/ }))
    await userEvent.click(screen.getByRole('button', { name: /السورة السابقة/ }))
    expect(await screen.findByRole('article', { name: 'نص سورة الفاتحة' })).toBeInTheDocument()
  })

  it("colours the student's earlier word mistakes", async () => {
    const before = lesson('2026-11-20', { notes: { s1: { mistakes: [{ s: 112, a: 2, w: 0, type: 'hifz' }] } } })
    renderApp('/mushaf?student=s1&s=112', { students: [yusuf], groups: [group], sessions: [before] }, { now: NOW })
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    expect(text.querySelectorAll('.w-c1')).toHaveLength(1)
  })

  it('is read-only without a student', async () => {
    renderApp('/mushaf?s=112', { students: [yusuf], groups: [group] }, { now: NOW })
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    expect(within(text).queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/اختار الطالب عشان تسجّل أخطاءه/)).toBeInTheDocument()
  })
})
