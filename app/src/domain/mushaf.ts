/**
 * The Quran text (Tanzil Uthmani, public/quran.txt) split into surahs, ayahs and words.
 * The text itself is never changed; only how it is displayed (the opening basmala of each
 * surah is shown as a heading, and pause marks stay attached to the word before them).
 */

/** Ayah texts per surah: surahs[s - 1][a - 1]. */
export type QuranText = string[][]

/** A word as shown: its text, plus any pause marks that follow it. */
export type Word = { text: string; marks: string }

const LETTER = /[ء-يٮ-ۓۺ-ۼ]/

/** Parse "s|a|text" lines; comment lines (the Tanzil notice) are skipped. */
export function parseQuran(raw: string): QuranText {
  const out: QuranText = []
  for (const line of raw.split('\n')) {
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line.trim())
    if (!m) continue
    const s = Number(m[1])
    ;(out[s - 1] ??= [])[Number(m[2]) - 1] = m[3]
  }
  return out
}

/** Every surah except al-Fatiha and at-Tawba opens with the basmala inside its first ayah. */
export const hasBasmalaHeading = (s: number) => s !== 1 && s !== 9

/** The words of an ayah, without the opening basmala that is shown as the surah heading. */
export function ayahWords(q: QuranText, s: number, a: number): Word[] {
  const text = q[s - 1]?.[a - 1] ?? ''
  const words: Word[] = []
  for (const token of text.split(' ').filter(Boolean)) {
    if (LETTER.test(token)) words.push({ text: token, marks: '' })
    else if (words.length) words[words.length - 1].marks += ` ${token}`
  }
  return a === 1 && hasBasmalaHeading(s) ? words.slice(4) : words
}

/** The basmala as written at the start of a surah (its first four words). */
export function basmala(q: QuranText, s: number): string {
  const text = q[s - 1]?.[0] ?? ''
  return text.split(' ').slice(0, 4).join(' ')
}

/** Plain text of an ayah as displayed (words and marks, without the opening basmala). */
export function ayahText(q: QuranText, s: number, a: number): string {
  return ayahWords(q, s, a)
    .map((w) => w.text + w.marks)
    .join(' ')
}
