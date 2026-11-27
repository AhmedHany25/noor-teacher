/**
 * Two small games built from what the student is memorising. The teacher sends a link; the
 * game opens without signing in. The link carries only the student's first name, the passages
 * and the ayahs to stress — the Quran text itself comes from the app.
 */
import type { Session } from './attendance'
import { ayahWords, type QuranText } from './mushaf'
import { repeatedMistakes } from './notes'
import { ayahCount, type Range } from './quran'

/** Passages are [surah, fromAyah, toAyah] inside one surah; weak ayahs are [surah, ayah]. */
export type GamePlan = { n: string; p: [number, number, number][]; m: [number, number][] }

type Ayah = { s: number; a: number }
export type Rng = () => number

const MAX_PASSAGE = 20
const MAX_WEAK = 10

/** Split a range into one passage per surah, keeping at most the last MAX_PASSAGE ayahs of each. */
function passagesOf(r: Range): [number, number, number][] {
  const out: [number, number, number][] = []
  const step = r.from.s <= r.to.s ? 1 : -1
  for (let s = r.from.s; ; s += step) {
    const from = s === r.from.s ? r.from.a : 1
    const to = s === r.to.s ? r.to.a : ayahCount(s)
    out.push([s, Math.max(from, to - MAX_PASSAGE + 1), to])
    if (s === r.to.s) break
  }
  return out
}

/** What to play: the latest memorised and reviewed passages, and the ayahs the student keeps missing. */
export function planFor(name: string, sessions: Session[], studentId: string): GamePlan | undefined {
  const notes = sessions
    .filter((s) => s.notes?.[studentId])
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => s.notes![studentId])
  const mem = notes.find((n) => n.memorized)?.memorized
  const rev = notes.find((n) => n.reviewed)?.reviewed
  const passages = [mem, rev]
    .filter((r): r is Range => !!r)
    .flatMap(passagesOf)
    .filter((p, i, all) => all.findIndex((q) => q[0] === p[0] && q[1] === p[1] && q[2] === p[2]) === i)
    .slice(0, 3)
  if (!passages.length) return undefined
  const latest = notes.find((n) => n.mistakes?.length)?.mistakes ?? []
  const weak: [number, number][] = [...repeatedMistakes(sessions, studentId), ...latest]
    .map((m): [number, number] => [m.s, m.a])
    .filter((m, i, all) => all.findIndex((x) => x[0] === m[0] && x[1] === m[1]) === i)
    .slice(0, MAX_WEAK)
  return { n: name.split(' ')[0], p: passages, m: weak }
}

/** URL-safe text for a plan (UTF-8, base64url). */
export function encodePlan(plan: GamePlan): string {
  const bytes = new TextEncoder().encode(JSON.stringify(plan))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodePlan(code: string): GamePlan | undefined {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const plan = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as GamePlan
    const okAyah = (s: number, a: number) => Number.isInteger(s) && s >= 1 && s <= 114 && Number.isInteger(a) && a >= 1 && a <= ayahCount(s)
    if (typeof plan.n !== 'string' || !Array.isArray(plan.p) || !Array.isArray(plan.m) || !plan.p.length) return undefined
    if (!plan.p.every(([s, f, t]) => okAyah(s, f) && okAyah(s, t) && f <= t)) return undefined
    if (!plan.m.every(([s, a]) => okAyah(s, a))) return undefined
    return { n: plan.n.slice(0, 40), p: plan.p, m: plan.m }
  } catch {
    return undefined
  }
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The ayahs to play with; small passages grow with their neighbours so there is enough to choose from. */
export function pool(plan: GamePlan): Ayah[] {
  const out: Ayah[] = []
  const add = (s: number, a: number) => {
    if (a >= 1 && a <= ayahCount(s) && !out.some((x) => x.s === s && x.a === a)) out.push({ s, a })
  }
  for (const [s, f, t] of plan.p) for (let a = f; a <= t; a++) add(s, a)
  for (const [s, f, t] of plan.p) {
    for (let d = 1; out.length < 6 && d <= 6; d++) {
      add(s, t + d)
      add(s, f - d)
    }
  }
  return out
}

/** Weak ayahs (inside the pool) first, then the rest shuffled. */
function playOrder(plan: GamePlan, rng: Rng): Ayah[] {
  const all = pool(plan)
  const weak = shuffle(
    all.filter((x) => plan.m.some(([s, a]) => s === x.s && a === x.a)),
    rng,
  )
  return [...weak, ...shuffle(all.filter((x) => !weak.includes(x)), rng)]
}

const textOf = (q: QuranText, s: number, a: number) => ayahWords(q, s, a).map((w) => w.text)

export type CompleteQuestion = { s: number; a: number; prompt: string; asks: 'rest' | 'next'; options: string[]; answer: string }

/** «كمّل الآية»: the start of an ayah (or a short ayah) and three possible continuations. */
export function completeQuestions(q: QuranText, plan: GamePlan, rng: Rng, count = 8): CompleteQuestion[] {
  const order = playOrder(plan, rng)
  const halves = (x: Ayah) => {
    const w = textOf(q, x.s, x.a)
    const cut = Math.ceil(w.length / 2)
    return { head: w.slice(0, cut).join(' '), tail: w.slice(cut).join(' '), long: w.length >= 6 }
  }
  const out: CompleteQuestion[] = []
  for (const x of order) {
    if (out.length >= count) break
    const h = halves(x)
    let prompt: string
    let answer: string
    let asks: CompleteQuestion['asks']
    let others: string[]
    if (h.long) {
      prompt = h.head
      answer = h.tail
      asks = 'rest'
      others = order.filter((y) => y !== x && textOf(q, y.s, y.a).length >= 4).map((y) => halves(y).tail)
    } else if (x.a < ayahCount(x.s)) {
      prompt = textOf(q, x.s, x.a).join(' ')
      answer = textOf(q, x.s, x.a + 1).join(' ')
      asks = 'next'
      others = order.map((y) => textOf(q, y.s, y.a).join(' '))
    } else continue
    const distractors = shuffle(
      [...new Set(others)].filter((t) => t && t !== answer && t !== prompt),
      rng,
    ).slice(0, 2)
    if (distractors.length < 2) continue
    out.push({ s: x.s, a: x.a, prompt, asks, answer, options: shuffle([answer, ...distractors], rng) })
  }
  return out
}

export type OrderRound = { s: number; a: number; words: string[]; shuffled: string[] }

/** «رتّب الكلمات»: the words of an ayah (its first eight at most), shuffled. */
export function orderRounds(q: QuranText, plan: GamePlan, rng: Rng, count = 5): OrderRound[] {
  const out: OrderRound[] = []
  for (const x of playOrder(plan, rng)) {
    if (out.length >= count) break
    const words = textOf(q, x.s, x.a).slice(0, 8)
    if (words.length < 3) continue
    let shuffled = shuffle(words, rng)
    for (let i = 0; i < 5 && shuffled.join(' ') === words.join(' '); i++) shuffled = shuffle(words, rng)
    out.push({ s: x.s, a: x.a, words, shuffled })
  }
  return out
}

/** ٣ stars from 90%, ٢ from 70%, else ١. */
export function stars(correct: number, total: number): number {
  if (!total) return 0
  const r = correct / total
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1
}

/** A repeatable random generator for tests. */
export function seeded(seed: number): Rng {
  let x = seed || 1
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}
