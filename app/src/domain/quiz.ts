/**
 * The memorisation games (each «سؤال الشيخ» question type is its own game), generated from the
 * full Quran text for whatever surahs are chosen — no manual content needed.
 */
import { ayahWords, type QuranText } from './mushaf'
import { ayahCount, surahName } from './quran'

export type QuizType = 'next' | 'prev' | 'from' | 'edge' | 'four' | 'name' | 'mcv' | 'mcs' | 'namef' | 'nameb' | 'namea' | 'cnt' | 'tf' | 'missing'

/** `choice`: has options the student can tap; otherwise the student answers aloud and the teacher judges. */
export const QUIZ_TYPES: Record<QuizType, { title: string; icon: string; hint: string; choice: boolean }> = {
  next: { title: 'الآية التالية', icon: '⬅️', hint: 'يقرأ الآية اللي بعدها', choice: false },
  prev: { title: 'الآية السابقة', icon: '➡️', hint: 'يقرأ الآية اللي قبلها', choice: false },
  from: { title: 'كمّل من قوله تعالى', icon: '✍️', hint: 'أول الآية، ويكمّلها', choice: false },
  four: { title: 'كمّل ٤ آيات', icon: '🔢', hint: 'يكمّل ٤ آيات بعد الآية', choice: false },
  edge: { title: 'أول وآخر السورة', icon: '📖', hint: 'يقرأ أول آية وآخر آية', choice: false },
  name: { title: 'اسم السورة من آية', icon: '🏷️', hint: 'يقول السورة من الآية', choice: false },
  mcv: { title: 'اختر الآية التالية', icon: '☑️', hint: 'من ٣ اختيارات', choice: true },
  missing: { title: 'الكلمة الناقصة', icon: '🧩', hint: 'يختار الكلمة اللي تكمّل الآية', choice: true },
  mcs: { title: 'اختر اسم السورة', icon: '📝', hint: 'الآية دي من أنهي سورة؟', choice: true },
  namef: { title: 'السورة اللي أولها الآية دي', icon: '🥇', hint: 'من أول آية في السورة', choice: true },
  nameb: { title: 'السورة اللي قبلها', icon: '⏪', hint: 'ترتيب السور', choice: true },
  namea: { title: 'السورة اللي بعدها', icon: '⏩', hint: 'ترتيب السور', choice: true },
  cnt: { title: 'عدد آيات السورة', icon: '📊', hint: 'كام آية في السورة؟', choice: true },
  tf: { title: 'صح أو خطأ', icon: '⚖️', hint: 'الآية دي من السورة دي؟', choice: true },
}

export const QUIZ_ORDER = Object.keys(QUIZ_TYPES) as QuizType[]

export type Question = {
  type: QuizType
  s: number
  a?: number
  /** What is asked, e.g. «إيه الآية اللي بعدها؟». */
  ask: string
  /** Quran text shown to the student (Uthmani). */
  quran?: string
  /** Plain text shown instead of (or above) the Quran text, e.g. a surah name. */
  plain?: string
  answer: string
  answerIsQuran: boolean
  options?: string[]
  optionsAreQuran?: boolean
  /** Where to review if missed, e.g. «النبأ ٥». */
  review: string
}

export type Rng = () => number

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])

function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const text = (q: QuranText, s: number, a: number) =>
  ayahWords(q, s, a)
    .map((w) => w.text + w.marks)
    .join(' ')
const words = (q: QuranText, s: number, a: number) => ayahWords(q, s, a).map((w) => w.text)
const where = (s: number, a?: number) => (a ? `${surahName(s)} ${ar(a)}` : surahName(s))

/** Two distinct wrong options (or fewer if impossible), different from the answer. */
function pickWrong(candidates: string[], answer: string, rng: Rng, n = 2): string[] {
  return shuffle([...new Set(candidates)].filter((c) => c && c !== answer), rng).slice(0, n)
}

/** Nearby surahs to fill name options when only one or two surahs are chosen. */
function surahChoices(surahs: number[], s: number): number[] {
  const near = [s - 2, s - 1, s + 1, s + 2].filter((x) => x >= 1 && x <= 114)
  return [...new Set([...surahs, ...near])].filter((x) => x !== s)
}

function one(type: QuizType, q: QuranText, surahs: number[], s: number, a: number, rng: Rng): Question | undefined {
  const n = ayahCount(s)
  const ayahPool = () => surahs.flatMap((x) => Array.from({ length: ayahCount(x) }, (_, i) => ({ s: x, a: i + 1 })))
  const randomAyahTexts = () => shuffle(ayahPool(), rng).slice(0, 12).map((x) => text(q, x.s, x.a))
  switch (type) {
    case 'next':
      if (a >= n) return
      return { type, s, a, ask: 'اقرأ الآية اللي بعدها', quran: text(q, s, a), answer: text(q, s, a + 1), answerIsQuran: true, review: where(s, a + 1) }
    case 'prev':
      if (a <= 1) return
      return { type, s, a, ask: 'اقرأ الآية اللي قبلها', quran: text(q, s, a), answer: text(q, s, a - 1), answerIsQuran: true, review: where(s, a - 1) }
    case 'from': {
      const w = words(q, s, a)
      if (w.length < 4) return
      return { type, s, a, ask: 'كمّل من قوله تعالى', quran: `${w.slice(0, Math.ceil(w.length / 3)).join(' ')} …`, answer: text(q, s, a), answerIsQuran: true, review: where(s, a) }
    }
    case 'four': {
      if (a + 4 > n) return
      const next = [1, 2, 3, 4].map((d) => `${text(q, s, a + d)} ﴿${ar(a + d)}﴾`).join(' ')
      return { type, s, a, ask: 'كمّل ٤ آيات بعد', quran: text(q, s, a), answer: next, answerIsQuran: true, review: `${where(s, a + 1)}–${ar(a + 4)}` }
    }
    case 'edge':
      return {
        type,
        s,
        ask: 'اقرأ أول آية وآخر آية في',
        plain: `سورة ${surahName(s)}`,
        answer: `${text(q, s, 1)} … ${text(q, s, n)}`,
        answerIsQuran: true,
        review: `${surahName(s)}: أولها وآخرها`,
      }
    case 'name':
      return { type, s, a, ask: 'الآية دي من أنهي سورة؟', quran: text(q, s, a), answer: `سورة ${surahName(s)}`, answerIsQuran: false, review: where(s, a) }
    case 'mcv': {
      if (a >= n) return
      const answer = text(q, s, a + 1)
      const wrong = pickWrong(randomAyahTexts(), answer, rng)
      if (wrong.length < 2) return
      return { type, s, a, ask: 'اختار الآية اللي بعدها', quran: text(q, s, a), answer, answerIsQuran: true, options: shuffle([answer, ...wrong], rng), optionsAreQuran: true, review: where(s, a + 1) }
    }
    case 'missing': {
      const w = ayahWords(q, s, a)
      if (w.length < 4) return
      const k = 1 + Math.floor(rng() * (w.length - 1))
      const answer = w[k].text
      const others = shuffle(ayahPool(), rng)
        .slice(0, 15)
        .flatMap((x) => words(q, x.s, x.a))
        .filter((x) => x.length >= Math.min(3, answer.length))
      const wrong = pickWrong(others, answer, rng)
      if (wrong.length < 2) return
      const shown = w.map((x, i) => (i === k ? '‏ ـــــ ' : x.text + x.marks)).join(' ')
      return { type, s, a, ask: 'إيه الكلمة الناقصة؟', quran: shown, answer, answerIsQuran: true, options: shuffle([answer, ...wrong], rng), optionsAreQuran: true, review: where(s, a) }
    }
    case 'mcs': {
      const answer = `سورة ${surahName(s)}`
      const wrong = pickWrong(surahChoices(surahs, s).map((x) => `سورة ${surahName(x)}`), answer, rng)
      return { type, s, a, ask: 'الآية دي من أنهي سورة؟', quran: text(q, s, a), answer, answerIsQuran: false, options: shuffle([answer, ...wrong], rng), review: where(s, a) }
    }
    case 'namef': {
      const answer = `سورة ${surahName(s)}`
      const wrong = pickWrong(surahChoices(surahs, s).map((x) => `سورة ${surahName(x)}`), answer, rng)
      return { type, s, a: 1, ask: 'أنهي سورة أولها الآية دي؟', quran: text(q, s, 1), answer, answerIsQuran: false, options: shuffle([answer, ...wrong], rng), review: `${surahName(s)}: أولها` }
    }
    case 'nameb':
    case 'namea': {
      const target = type === 'nameb' ? s - 1 : s + 1
      if (target < 1 || target > 114) return
      const answer = `سورة ${surahName(target)}`
      const wrong = pickWrong([s - 2, s + 2, s - 1, s + 1, s - 3, s + 3].filter((x) => x >= 1 && x <= 114 && x !== s).map((x) => `سورة ${surahName(x)}`), answer, rng)
      return {
        type,
        s,
        ask: type === 'nameb' ? 'إيه السورة اللي قبل' : 'إيه السورة اللي بعد',
        plain: `سورة ${surahName(s)}`,
        answer,
        answerIsQuran: false,
        options: shuffle([answer, ...wrong], rng),
        review: `ترتيب ${surahName(s)}`,
      }
    }
    case 'cnt': {
      const answer = ar(n)
      const wrong = pickWrong(
        [n - 1, n + 1, n - 2, n + 2, n + 3].filter((x) => x > 0).map(ar),
        answer,
        rng,
      )
      return { type, s, ask: 'كام آية في', plain: `سورة ${surahName(s)}`, answer, answerIsQuran: false, options: shuffle([answer, ...wrong], rng), review: `عدد آيات ${surahName(s)}` }
    }
    case 'tf': {
      const truth = rng() < 0.5
      const other = shuffle(surahChoices(surahs, s), rng)[0]
      const said = truth || !other ? s : other
      return {
        type,
        s,
        a,
        ask: `الآية دي من سورة ${surahName(said)}؟`,
        quran: text(q, s, a),
        answer: said === s ? 'صح' : 'خطأ',
        answerIsQuran: false,
        options: ['صح', 'خطأ'],
        review: where(s, a),
      }
    }
  }
}

/** `count` questions of one type from the chosen surahs (whole surahs), never the same place twice. */
export function quizQuestions(type: QuizType, q: QuranText, surahs: number[], rng: Rng, count = 10): Question[] {
  const surahLevel = type === 'edge' || type === 'nameb' || type === 'namea' || type === 'cnt' || type === 'namef'
  const places = surahLevel
    ? surahs.map((s) => ({ s, a: 1 }))
    : surahs.flatMap((s) => Array.from({ length: ayahCount(s) }, (_, i) => ({ s, a: i + 1 })))
  const out: Question[] = []
  for (const p of shuffle(places, rng)) {
    if (out.length >= count) break
    const x = one(type, q, surahs, p.s, p.a, rng)
    if (x) out.push(x)
  }
  return out
}

/** A repeatable random generator for tests. */
export function seededRng(seed: number): Rng {
  let x = seed || 1
  return () => {
    x = (x * 16807) % 2147483647
    return (x - 1) / 2147483646
  }
}
