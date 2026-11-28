/** Rounds for the verse games (order, erase) and the teacher-content games (picture, meanings, situation). */
import type { PicItem, SituationItem, WordItem } from './gameContent'
import { ayahWords, type QuranText } from './mushaf'
import { ayahCount, surahName } from './quran'
import type { Rng } from './quiz'

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])

export type OrderTask = { s: number; a: number; words: string[]; shuffled: string[] }

/** «رتّب الآية»: ayahs of 3+ words (the first eight words of long ones), shuffled. */
export function orderTasks(q: QuranText, surahs: number[], rng: Rng, count = 6): OrderTask[] {
  const places = shuffle(
    surahs.flatMap((s) => Array.from({ length: ayahCount(s) }, (_, i) => ({ s, a: i + 1 }))),
    rng,
  )
  const out: OrderTask[] = []
  for (const p of places) {
    if (out.length >= count) break
    const words = ayahWords(q, p.s, p.a)
      .map((w) => w.text)
      .slice(0, 8)
    if (words.length < 3) continue
    let shuffled = shuffle(words, rng)
    for (let i = 0; i < 5 && shuffled.join(' ') === words.join(' '); i++) shuffled = shuffle(words, rng)
    out.push({ ...p, words, shuffled })
  }
  return out
}

export type PicQuestion = { item: PicItem; options: string[]; answer: string }

/** «اختر السورة من الصورة»: one picture per question, the right surah among three. */
export function picQuestions(items: PicItem[], allSurahsWithPics: number[], rng: Rng, count = 10): PicQuestion[] {
  return shuffle(items, rng)
    .slice(0, count)
    .map((item) => {
      const answer = `سورة ${surahName(item.s)}`
      const near = [item.s - 1, item.s + 1, item.s - 2, item.s + 2].filter((x) => x >= 1 && x <= 114)
      const wrong = shuffle([...new Set([...allSurahsWithPics, ...near])].filter((x) => x !== item.s), rng)
        .slice(0, 2)
        .map((x) => `سورة ${surahName(x)}`)
      return { item, answer, options: shuffle([answer, ...wrong], rng) }
    })
}

export type MatchRound = { pairs: WordItem[]; meanings: WordItem[] }

/** «مطابقة الكلمات»: rounds of up to four words, each with its meanings shuffled. */
export function matchRounds(items: WordItem[], rng: Rng, rounds = 3, size = 4): MatchRound[] {
  const pool = shuffle(items, rng).slice(0, rounds * size)
  const out: MatchRound[] = []
  for (let i = 0; i < pool.length; i += size) {
    const pairs = pool.slice(i, i + size)
    if (pairs.length < 2) break
    out.push({ pairs, meanings: shuffle(pairs, rng) })
  }
  return out
}

export type SituationQuestion = { item: SituationItem; options: string[] }

export function situationQuestions(items: SituationItem[], rng: Rng, count = 10): SituationQuestion[] {
  return shuffle(items, rng)
    .slice(0, count)
    .map((item) => ({ item, options: shuffle([item.right, ...item.wrong.filter(Boolean)], rng) }))
}

/** «النبأ ١–١٠» */
export const passageText = (s: number, from: number, to: number) => (from === to ? `${surahName(s)} ${ar(from)}` : `${surahName(s)} ${ar(from)}–${ar(to)}`)
