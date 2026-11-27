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
  it('records a mistake on a tapped word in the lesson notes, and removes it on a second tap', async () => {
    const { repos } = renderApp(
      '/mushaf?session=g_2026-11-27&student=s1&s=112&a=1&to=4',
      { students: [yusuf], groups: [group], sessions: [lesson('2026-11-27')] },
      { now: NOW },
    )
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    const words = within(text).getAllByRole('button')
    expect(words).toHaveLength(15) // al-Ikhlas: 4 + 2 + 4 + 5 words
    await userEvent.click(words[2])
    await userEvent.click(within(screen.getByRole('dialog', { name: 'تسجيل غلطة' })).getByRole('button', { name: 'حفظ' }))
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toEqual([{ s: 112, a: 1, w: 2, type: 'hifz' }])

    await userEvent.click(within(screen.getByRole('article')).getAllByRole('button')[2])
    await userEvent.click(screen.getByRole('button', { name: 'شيل (حفظ)' }))
    expect(repos.sessions.all()[0].notes?.s1?.mistakes).toBeUndefined()
  })

  it("colours the student's earlier word mistakes and is read-only without a lesson", async () => {
    const before = lesson('2026-11-20', { notes: { s1: { mistakes: [{ s: 112, a: 2, w: 0, type: 'hifz' }] } } })
    renderApp('/mushaf?student=s1&s=112', { students: [yusuf], groups: [group], sessions: [before] }, { now: NOW })
    const text = await screen.findByRole('article', { name: 'نص سورة الإخلاص' })
    expect(within(text).queryAllByRole('button')).toHaveLength(0)
    expect(text.querySelectorAll('.w-c1')).toHaveLength(1)
  })
})
