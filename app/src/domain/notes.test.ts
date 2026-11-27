import { describe, expect, it } from 'vitest'
import type { Session } from './attendance'
import { previousHomework, suggestedStart, toggleWordMistake, wordMistakeCounts, type LessonNote } from './notes'

const ses = (date: string, note: LessonNote, sid = 's1'): Session => ({
  id: `g_${date}`,
  groupId: 'g',
  date,
  time: '17:00',
  kind: 'regular',
  attendance: { [sid]: { status: 'p', billable: true } },
  notes: { [sid]: note },
  updatedAt: 1,
})

describe('suggestedStart', () => {
  it('continues after the last memorised ayah', () => {
    const history = [ses('2026-11-06', { memorized: { from: { s: 2, a: 1 }, to: { s: 2, a: 10 } } })]
    expect(suggestedStart(history, 's1', '2026-11-13')).toEqual({ s: 2, a: 11 })
  })

  it('moves to the previous surah for a child memorising Juz Amma from the end', () => {
    const history = [
      ses('2026-11-06', { memorized: { from: { s: 114, a: 1 }, to: { s: 114, a: 6 } } }),
      ses('2026-11-13', { memorized: { from: { s: 113, a: 1 }, to: { s: 113, a: 5 } } }),
    ]
    expect(suggestedStart(history, 's1', '2026-11-20')).toEqual({ s: 112, a: 1 })
  })

  it('ignores this lesson and later ones, and other students', () => {
    const history = [
      ses('2026-11-06', { memorized: { from: { s: 2, a: 1 }, to: { s: 2, a: 10 } } }),
      ses('2026-11-13', { memorized: { from: { s: 2, a: 11 }, to: { s: 2, a: 20 } } }),
      ses('2026-11-10', { memorized: { from: { s: 50, a: 1 }, to: { s: 50, a: 5 } } }, 's2'),
    ]
    expect(suggestedStart(history, 's1', '2026-11-13')).toEqual({ s: 2, a: 11 })
  })

  it('has no suggestion without history', () => {
    expect(suggestedStart([], 's1', '2026-11-13')).toBeUndefined()
  })
})

describe('previousHomework', () => {
  it('finds the most recent homework given before this lesson', () => {
    const history = [
      ses('2026-11-06', { homework: 'حفظ النبأ ١–١٠' }),
      ses('2026-11-09', { rating: 'good' }),
      ses('2026-11-13', { homework: 'مراجعة النبأ' }),
    ]
    expect(previousHomework(history, 's1', '2026-11-13')).toEqual({ date: '2026-11-06', text: 'حفظ النبأ ١–١٠' })
    expect(previousHomework(history, 's1', '2026-11-20')).toEqual({ date: '2026-11-13', text: 'مراجعة النبأ' })
    expect(previousHomework(history, 's1', '2026-11-06')).toBeUndefined()
  })
})

describe('word mistakes', () => {
  it('counts lessons with a mistake on each word, optionally skipping the current lesson', () => {
    const list = [
      ses('2026-11-01', { mistakes: [{ s: 78, a: 5, w: 2, type: 'hifz' }, { s: 78, a: 6, type: 'hifz' }] }),
      ses('2026-11-08', { mistakes: [{ s: 78, a: 5, w: 2, type: 'tajweed' }] }),
    ]
    expect(wordMistakeCounts(list, 's1').get('78:5:2')).toBe(2)
    expect(wordMistakeCounts(list, 's1', 'g_2026-11-08').get('78:5:2')).toBe(1)
    expect(wordMistakeCounts(list, 's1').size).toBe(1)
  })

  it('toggles a word: same type removes it, another type replaces it', () => {
    const m = { s: 78, a: 5, w: 2, type: 'hifz' as const }
    const one = toggleWordMistake([], m)
    expect(one).toEqual([m])
    expect(toggleWordMistake(one, { ...m, type: 'tajweed' })).toEqual([{ ...m, type: 'tajweed' }])
    expect(toggleWordMistake(one, m)).toEqual([])
  })
})
