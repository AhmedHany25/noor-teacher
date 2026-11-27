import { SURAHS } from './surahs'

export type Position = { s: number; a: number } // surah 1–114, ayah 1–n
export type Range = { from: Position; to: Position }
export type Direction = 'forward' | 'backward'

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])

export const surahName = (s: number): string => SURAHS[s - 1]?.[0] ?? ''
export const ayahCount = (s: number): number => SURAHS[s - 1]?.[1] ?? 0

const validPos = (p: Position) => p.s >= 1 && p.s <= 114 && p.a >= 1 && p.a <= ayahCount(p.s)

/** Both ends exist; inside one surah the end cannot come before the start. */
export function validRange(r: Range): boolean {
  if (!validPos(r.from) || !validPos(r.to)) return false
  return r.from.s !== r.to.s || r.from.a <= r.to.a
}

/** «النبأ ١–١٠», «الفاتحة ٥», «الإخلاص كاملة», «النبأ ٣١ – النازعات ٥». */
export function rangeText(r: Range): string {
  const { from, to } = r
  if (from.s === to.s) {
    if (from.a === 1 && to.a === ayahCount(from.s)) return `${surahName(from.s)} كاملة`
    if (from.a === to.a) return `${surahName(from.s)} ${ar(from.a)}`
    return `${surahName(from.s)} ${ar(from.a)}–${ar(to.a)}`
  }
  return `${surahName(from.s)} ${ar(from.a)} – ${surahName(to.s)} ${ar(to.a)}`
}

/** Number of ayahs from start to end, whether the student moves forward or from the end of the mushaf. */
export function ayahsInRange(r: Range): number {
  const { from, to } = r
  if (from.s === to.s) return to.a - from.a + 1
  const step = to.s > from.s ? 1 : -1
  let n = ayahCount(from.s) - from.a + 1
  for (let s = from.s + step; s !== to.s; s += step) n += ayahCount(s)
  return n + to.a
}

/** Where the next new memorisation starts after `end`. */
export function nextStart(end: Position, direction: Direction): Position | undefined {
  if (end.a < ayahCount(end.s)) return { s: end.s, a: end.a + 1 }
  const s = direction === 'forward' ? end.s + 1 : end.s - 1
  return s >= 1 && s <= 114 ? { s, a: 1 } : undefined
}

/**
 * Direction from the starts of the most recent ranges (oldest first). With one range,
 * Juz Amma (An-Naba onwards) is assumed to be memorised from the end, as most children do.
 */
export function guessDirection(starts: Position[]): Direction {
  const [prev, last] = starts.slice(-2)
  if (last && prev && last.s !== prev.s) return last.s < prev.s ? 'backward' : 'forward'
  const only = last ?? prev
  return only && only.s >= 78 ? 'backward' : 'forward'
}
