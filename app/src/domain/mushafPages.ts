/**
 * Splits a surah into pages that fit the screen, so the mushaf only ever draws one page
 * (fast even for al-Baqara). Pages break at the end of an ayah when possible.
 */
import { ayahWords, type QuranText, type Word } from './mushaf'

/** One thing on a page: a word (ayah a, word index w) or the ayah's end marker. */
export type Unit = { a: number; w: number; word: Word } | { a: number; end: true }

const MARKS = /[ً-ٰٟۖ-ۭـ]/g
const letters = (t: string) => t.replace(MARKS, '').length

export function surahUnits(q: QuranText, s: number): Unit[] {
  const out: Unit[] = []
  const n = q[s - 1]?.length ?? 0
  for (let a = 1; a <= n; a++) {
    ayahWords(q, s, a).forEach((word, w) => out.push({ a, w, word }))
    out.push({ a, end: true })
  }
  return out
}

/**
 * Page starts (indexes into units). `budget` is how many letters fit on a page; the first page
 * has less room (surah title and basmala). A page ends after an ayah marker unless one ayah is
 * longer than a whole page, which then continues on the next page.
 */
export function pageStarts(units: Unit[], budget: number, firstBudget = budget * 0.7): number[] {
  const starts = [0]
  let used = 0
  let lastEnd = -1 // index after the last ayah end on this page
  for (let i = 0; i < units.length; i++) {
    const u = units[i]
    const cost = 'end' in u ? 3 : letters(u.word.text) + 1
    const room = starts.length === 1 ? firstBudget : budget
    if (used + cost > room && i > starts[starts.length - 1]) {
      const cut = lastEnd > starts[starts.length - 1] ? lastEnd : i
      starts.push(cut)
      used = 0
      lastEnd = -1
      i = cut - 1
      continue
    }
    used += cost
    if ('end' in u) lastEnd = i + 1
  }
  return starts
}

/** The page holding ayah `a` (its first word). */
export function pageOfAyah(units: Unit[], starts: number[], a: number): number {
  const i = units.findIndex((u) => u.a === a)
  if (i < 0) return 0
  let p = 0
  while (p + 1 < starts.length && starts[p + 1] <= i) p++
  return p
}

/** Letters per page for a page box of this size and font (Amiri Quran at line-height 2.3). */
export function letterBudget(widthPx: number, fontPx: number, lines: number): number {
  const perLine = widthPx / (fontPx * 0.42)
  return Math.max(80, Math.floor(perLine * lines))
}

/** Where each juz starts: [surah, ayah]. */
export const JUZ_STARTS: [number, number][] = [
  [1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41],
  [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56],
  [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1],
]

/** Page of the Madinah mushaf where each surah starts. */
export const SURAH_PAGE = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322, 332, 342, 350, 359, 367, 377, 385,
  396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467, 477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531,
  534, 537, 542, 545, 549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585, 586, 587,
  587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603,
  603, 603, 604, 604, 604,
]

export function juzOf(s: number, a: number): number {
  let j = 1
  JUZ_STARTS.forEach(([js, ja], i) => {
    if (js < s || (js === s && ja <= a)) j = i + 1
  })
  return j
}
