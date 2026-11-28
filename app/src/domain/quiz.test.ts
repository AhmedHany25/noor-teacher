import { describe, expect, it } from 'vitest'
import raw from '../../public/quran.txt?raw'
import { ayahText, parseQuran } from './mushaf'
import { QUIZ_ORDER, QUIZ_TYPES, quizQuestions, seededRng } from './quiz'

const q = parseQuran(raw)

describe('memorisation games', () => {
  it('makes questions of every type from any surahs', () => {
    for (const type of QUIZ_ORDER) {
      const qs = quizQuestions(type, q, [78, 79, 80], seededRng(5), 5)
      expect(qs.length, type).toBeGreaterThan(0)
      for (const x of qs) {
        expect(x.type).toBe(type)
        expect(x.answer).toBeTruthy()
        if (QUIZ_TYPES[type].choice) {
          expect(x.options, type).toContain(x.answer)
          expect(new Set(x.options).size).toBe(x.options!.length)
        } else expect(x.options).toBeUndefined()
      }
    }
  })

  it('asks for the next ayah with the real next ayah as the answer', () => {
    const [x] = quizQuestions('next', q, [112], seededRng(2), 1)
    expect(x.answer).toBe(ayahText(q, 112, x.a! + 1))
    expect(x.review).toMatch(/^الإخلاص /)
  })

  it('never repeats a place, and stops when the surahs run out', () => {
    const qs = quizQuestions('prev', q, [108], seededRng(1), 10) // al-Kawthar: 3 ayahs, ayah 1 has no previous
    expect(qs).toHaveLength(2)
    expect(new Set(qs.map((x) => x.a)).size).toBe(2)
  })

  it('hides one word for «الكلمة الناقصة»', () => {
    for (const x of quizQuestions('missing', q, [78], seededRng(9), 5)) {
      expect(x.quran).toContain('ـــــ')
      expect(x.options).toHaveLength(3)
    }
  })

  it('knows surah order and ayah counts', () => {
    const [b] = quizQuestions('nameb', q, [78], seededRng(3), 1)
    expect(b.answer).toBe('سورة المرسلات')
    const [c] = quizQuestions('cnt', q, [78], seededRng(3), 1)
    expect(c.answer).toBe('٤٠')
  })
})
