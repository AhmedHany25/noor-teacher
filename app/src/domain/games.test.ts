import { describe, expect, it } from 'vitest'
import raw from '../../public/quran.txt?raw'
import type { Session } from './attendance'
import { completeQuestions, decodePlan, encodePlan, orderRounds, planFor, pool, seeded, stars, type GamePlan } from './games'
import { ayahWords, parseQuran } from './mushaf'
import type { LessonNote } from './notes'

const q = parseQuran(raw)

const ses = (date: string, note: LessonNote): Session => ({
  id: `g_${date}`,
  groupId: 'g',
  date,
  time: '17:00',
  kind: 'regular',
  attendance: { s1: { status: 'p', billable: true } },
  notes: { s1: note },
  updatedAt: 1,
})

describe('game plan', () => {
  it('uses the latest memorised and reviewed passages and the ayahs the student keeps missing', () => {
    const sessions = [
      ses('2026-11-01', { memorized: { from: { s: 78, a: 1 }, to: { s: 78, a: 10 } }, mistakes: [{ s: 78, a: 4, type: 'hifz' }] }),
      ses('2026-11-08', {
        memorized: { from: { s: 78, a: 11 }, to: { s: 78, a: 20 } },
        reviewed: { from: { s: 112, a: 1 }, to: { s: 114, a: 6 } },
        mistakes: [{ s: 78, a: 4, type: 'hifz' }, { s: 78, a: 15, type: 'tajweed' }],
      }),
    ]
    expect(planFor('يوسف أحمد', sessions, 's1')).toEqual({
      n: 'يوسف',
      p: [
        [78, 11, 20],
        [112, 1, 4],
        [113, 1, 5],
      ],
      m: [
        [78, 4],
        [78, 15],
      ],
    })
    expect(planFor('يوسف', [], 's1')).toBeUndefined()
  })

  it('travels in the link and rejects anything broken', () => {
    const plan: GamePlan = { n: 'يوسف', p: [[78, 1, 10]], m: [[78, 4]] }
    const code = encodePlan(plan)
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodePlan(code)).toEqual(plan)
    expect(decodePlan('not-a-plan')).toBeUndefined()
    expect(decodePlan(encodePlan({ ...plan, p: [[78, 1, 99]] }))).toBeUndefined()
  })

  it('grows a short passage with neighbouring ayahs', () => {
    expect(pool({ n: '', p: [[112, 1, 2]], m: [] }).length).toBe(4)
  })
})

describe('games', () => {
  const plan: GamePlan = { n: 'يوسف', p: [[78, 1, 20]], m: [[78, 9]] }

  it('asks to complete ayahs, weak ayahs first, with the right answer among three', () => {
    const qs = completeQuestions(q, plan, seeded(7))
    expect(qs).toHaveLength(8)
    expect(qs[0]).toMatchObject({ s: 78, a: 9 })
    for (const x of qs) {
      expect(x.options).toHaveLength(3)
      expect(new Set(x.options).size).toBe(3)
      expect(x.options).toContain(x.answer)
    }
  })

  it('shuffles the words of an ayah to put back in order', () => {
    const rounds = orderRounds(q, plan, seeded(3))
    expect(rounds).toHaveLength(5)
    for (const r of rounds) {
      expect([...r.shuffled].sort()).toEqual([...r.words].sort())
      expect(r.words).toEqual(ayahWords(q, r.s, r.a).map((w) => w.text).slice(0, 8))
    }
  })

  it('gives stars for the score', () => {
    expect([stars(8, 8), stars(6, 8), stars(3, 8), stars(0, 0)]).toEqual([3, 2, 1, 0])
  })
})
