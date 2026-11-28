import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { GameContent } from '../../domain/gameContent'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'
import raw from '../../../public/quran.txt?raw'

beforeAll(() => {
  vi.stubGlobal('fetch', async () => new Response(raw))
})

const yusuf: Student = { id: 'y1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const group: Group = {
  id: 'g',
  studentIds: ['y1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
}
// Friday 27 Nov 2026: Yusuf has a lesson at 17:00.
const NOW = new Date(2026, 10, 27, 16, 0)
const seeded = { profile: { gameSeeded: true } }

describe('Games', () => {
  it('loads the ready-made content once and lists every game, each question type on its own', async () => {
    const { repos } = renderApp('/games', { students: [yusuf] }, { now: NOW })
    await waitFor(() => expect(repos.gameContent.all().length).toBeGreaterThan(100))
    expect(repos.profileNow().gameSeeded).toBe(true)
    expect(screen.getByRole('region', { name: 'أسئلة الحفظ' }).querySelectorAll('.game-tile')).toHaveLength(14)
    expect(screen.getByRole('region', { name: 'ألعاب المعاني' })).toHaveTextContent('اختار السور الأول')
  })

  it('shows which surahs a content game works on', async () => {
    const pics: GameContent[] = [{ id: 'c1', kind: 'pic', s: 105, emoji: '🐘', hint: 'أصحاب الفيل' }]
    renderApp('/games?s=105,106', { students: [yusuf], gameContent: pics, ...seeded }, { now: NOW })
    const tile = screen.getByRole('link', { name: /اختر السورة من الصورة/ })
    expect(tile).toHaveTextContent('شغالة على: الفيل')
    expect(tile.getAttribute('href')).toContain('s=105')
    expect(screen.getByRole('link', { name: /موقف وآية: أضف محتوى/ })).toHaveAttribute('href', '/games/content')
  })

  it('plays a memorisation game judged by the teacher and saves the result in the lesson today', async () => {
    const { repos } = renderApp('/games/next?student=y1&s=112&n=3', { students: [yusuf], groups: [group], ...seeded }, { now: NOW })
    for (let i = 0; i < 3; i++) {
      await userEvent.click(await screen.findByRole('button', { name: 'اعرض الإجابة' }))
      await userEvent.click(screen.getByRole('button', { name: i === 1 ? 'بمساعدة' : 'صح' }))
    }
    const result = await screen.findByRole('region', { name: 'النتيجة' })
    expect(result).toHaveTextContent('اتسجلت في حصة يوسف النهارده')
    const session = repos.sessions.all()[0]
    expect(session).toMatchObject({ id: 'g_2026-11-27', attendance: { y1: { status: 'p' } } })
    expect(session.notes?.y1?.games).toEqual([
      expect.objectContaining({ game: 'next', title: 'الآية التالية', ok: 2, help: 1, bad: 0, surahs: [112], review: [expect.stringMatching(/^الإخلاص/)] }),
    ])
  })

  it('lets the student tap the answer in choice games', async () => {
    renderApp('/games/cnt?s=112&n=1&mode=tap', { students: [yusuf], ...seeded }, { now: NOW })
    await userEvent.click(await screen.findByRole('button', { name: '٤' }))
    expect(screen.getByText('صح، برافو!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'النتيجة' }))
    expect(screen.getByRole('region', { name: 'النتيجة' })).toHaveTextContent('اختار الطالب من صفحة الألعاب')
  })

  it('matches words with their meanings', async () => {
    const words: GameContent[] = [
      { id: 'w1', kind: 'word', s: 57, a: 4, word: 'يَلِجُ', meaning: 'يدخل' },
      { id: 'w2', kind: 'word', s: 57, a: 4, word: 'يَعْرُجُ', meaning: 'يصعد' },
    ]
    renderApp('/games/match?s=57&n=4', { students: [yusuf], gameContent: words, ...seeded }, { now: NOW })
    const grid = await screen.findByRole('region', { name: 'المطابقة' })
    await userEvent.click(within(grid).getByRole('button', { name: 'يَلِجُ' }))
    await userEvent.click(within(grid).getByRole('button', { name: 'يدخل' }))
    await userEvent.click(within(grid).getByRole('button', { name: 'يَعْرُجُ' }))
    await userEvent.click(within(grid).getByRole('button', { name: 'يصعد' }))
    expect(screen.getByText('كلها صح، برافو!')).toBeInTheDocument()
  })

  it('adds a word meaning from the content screen', async () => {
    const { repos } = renderApp('/games/content', { students: [yusuf], ...seeded }, { now: NOW })
    await userEvent.click(screen.getByRole('tab', { name: /معاني الكلمات/ }))
    await userEvent.click(screen.getByRole('button', { name: '+ إضافة' }))
    const form = screen.getByRole('form', { name: 'إضافة' })
    await userEvent.selectOptions(within(form).getByLabelText('السورة'), '٧٨. النبأ')
    await userEvent.type(within(form).getByLabelText('الكلمة'), 'سُبَاتًا')
    await userEvent.type(within(form).getByLabelText('رقم الآية (اختياري)'), '9')
    await userEvent.type(within(form).getByLabelText('المعنى'), 'راحة')
    await userEvent.click(within(form).getByRole('button', { name: 'حفظ' }))
    expect(repos.gameContent.all()).toEqual([expect.objectContaining({ kind: 'word', s: 78, a: 9, word: 'سُبَاتًا', meaning: 'راحة' })])
  })
})
