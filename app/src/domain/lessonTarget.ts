/**
 * Which lesson notes go to when the teacher works with a student outside the lesson page
 * (the mushaf, the games): the lesson in the link, else the student's lesson today, else
 * (when allowed) their last attended lesson. Writing records the student present if needed.
 */
import { quickRecord, sessionId, type Session, type SessionInput } from './attendance'
import type { LessonNote } from './notes'
import { occurrencesOn, type Group, type Occurrence } from './schedule'

export type LessonTarget = { session?: Session; occ?: Occurrence; today: boolean }

export function findLessonTarget(input: {
  studentId: string
  groups: Group[]
  sessions: Session[]
  today: string
  linkedSessionId?: string | null
  allowPast?: boolean
}): LessonTarget | undefined {
  const { studentId, groups, sessions, today } = input
  const inGroup = (groupId: string) => groups.find((g) => g.id === groupId)?.studentIds.includes(studentId)
  const linked = sessions.find((x) => x.id === input.linkedSessionId)
  if (linked && (linked.attendance[studentId] || inGroup(linked.groupId))) return { session: linked, today: linked.date === today }
  const occ = occurrencesOn(groups, today).find((o) => !o.cancelledBy && inGroup(o.groupId))
  if (occ) return { session: sessions.find((x) => x.id === sessionId(occ.groupId, occ.date)), occ, today: true }
  if (!input.allowPast) return undefined
  const last = sessions
    .filter((x) => x.attendance[studentId]?.status === 'p' && x.date <= today)
    .sort((x, y) => y.date.localeCompare(x.date))[0]
  return last ? { session: last, today: false } : undefined
}

export type NoteWrite =
  | { kind: 'patch'; id: string; fields: Partial<Session>; recordedPresent: boolean }
  | { kind: 'put'; id: string; value: SessionInput; recordedPresent: true }

/** The write that sets this student's note in the target lesson, recording them present if they were not. */
export function noteWrite(target: LessonTarget, studentId: string, note: LessonNote, groups: Group[], now: number): NoteWrite | undefined {
  const present = { status: 'p' as const, billable: true }
  const s = target.session
  if (s) {
    const notes = { ...s.notes, [studentId]: note }
    if (s.attendance[studentId]) return { kind: 'patch', id: s.id, fields: { notes }, recordedPresent: false }
    return { kind: 'patch', id: s.id, fields: { notes, attendance: { ...s.attendance, [studentId]: present } }, recordedPresent: true }
  }
  if (!target.occ) return undefined
  const g = groups.find((x) => x.id === target.occ!.groupId)
  if (!g) return undefined
  return {
    kind: 'put',
    id: sessionId(target.occ.groupId, target.occ.date),
    value: { ...quickRecord(target.occ, g, 'p', undefined, now), attendance: { [studentId]: present }, notes: { [studentId]: note } },
    recordedPresent: true,
  }
}
