import type { Session } from './attendance'
import { guessDirection, nextStart, type Position, type Range } from './quran'

export type Rating = 'excellent' | 'very_good' | 'good' | 'needs_review'
export type HomeworkStatus = 'done' | 'partial' | 'no'
export type MistakeType = 'hifz' | 'tajweed' | 'pronunciation'

/** A place in the Quran the student got wrong in this lesson. */
export type Mistake = { s: number; a: number; type: MistakeType; note?: string }

/** What the teacher writes about one student in one lesson. Every field is optional. */
export type LessonNote = {
  memorized?: Range
  reviewed?: Range
  rating?: Rating
  note?: string
  /** Homework given for the next lesson. */
  homework?: string
  /** How the previous homework went, checked in this lesson. */
  homeworkStatus?: HomeworkStatus
  mistakes?: Mistake[]
}

export const RATING_TEXT: Record<Rating, string> = {
  excellent: 'ممتاز',
  very_good: 'جيد جدًا',
  good: 'جيد',
  needs_review: 'يحتاج مراجعة',
}

export const MISTAKE_TEXT: Record<MistakeType, string> = { hifz: 'حفظ', tajweed: 'تجويد', pronunciation: 'نطق' }

export const HOMEWORK_TEXT: Record<HomeworkStatus, string> = { done: 'اتعمل', partial: 'جزء منه', no: 'ما اتعملش' }

/** This student's notes from lessons before `date`, oldest first. */
function earlierNotes(sessions: Session[], studentId: string, date: string): { date: string; note: LessonNote }[] {
  return sessions
    .filter((s) => s.date < date && s.notes?.[studentId])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, note: s.notes![studentId] }))
}

/** Where new memorisation should start in a lesson on `date`, from the student's history. */
export function suggestedStart(sessions: Session[], studentId: string, date: string): Position | undefined {
  const ranges = earlierNotes(sessions, studentId, date)
    .map((x) => x.note.memorized)
    .filter((r): r is Range => !!r)
  const last = ranges.at(-1)
  if (!last) return undefined
  return nextStart(last.to, guessDirection(ranges.map((r) => r.from)))
}

/** The latest homework given before `date`. */
export function previousHomework(sessions: Session[], studentId: string, date: string): { date: string; text: string } | undefined {
  const withHomework = earlierNotes(sessions, studentId, date).filter((x) => x.note.homework?.trim())
  const last = withHomework.at(-1)
  return last ? { date: last.date, text: last.note.homework!.trim() } : undefined
}

/** How many times each ayah was a mistake for this student, across all lessons. Key: "s:a". */
export function mistakeCounts(sessions: Session[], studentId: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    for (const x of s.notes?.[studentId]?.mistakes ?? []) {
      const k = `${x.s}:${x.a}`
      m.set(k, (m.get(k) ?? 0) + 1)
    }
  }
  return m
}

/** Ayahs with mistakes in two or more lessons, most frequent first. */
export function repeatedMistakes(sessions: Session[], studentId: string): { s: number; a: number; count: number }[] {
  return [...mistakeCounts(sessions, studentId)]
    .filter(([, n]) => n >= 2)
    .map(([k, count]) => {
      const [s, a] = k.split(':').map(Number)
      return { s, a, count }
    })
    .sort((x, y) => y.count - x.count || x.s - y.s || x.a - y.a)
}
