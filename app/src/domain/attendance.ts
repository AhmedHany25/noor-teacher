import type { LessonNote } from './notes'
import { addDays, occurrencesOn, type CancelledBy, type Group, type GroupException, type LessonKind, type Occurrence } from './schedule'

export type AttendanceStatus = 'p' | 'a' | 'e' // present, absent, excused

export type StudentAttendance = { status: AttendanceStatus; billable: boolean }

/** A lesson that happened (attendance recorded). Id = `${groupId}_${date}`. */
export type Session = {
  id: string
  groupId: string
  date: string
  time: string
  kind: LessonKind
  actualDurationMin?: number
  attendance: Record<string, StudentAttendance>
  makeupFor?: string
  note?: string
  /** Per-student lesson notes (memorisation, review, rating, homework). */
  notes?: Record<string, LessonNote>
  /** When the parent message was sent, per student (ms since epoch). */
  sent?: Record<string, number>
  updatedAt: number
}

export type SessionInput = Omit<Session, 'id'>

export const STATUS_TEXT: Record<AttendanceStatus, string> = { p: 'حضر', a: 'غاب', e: 'اعتذر' }

export function sessionId(groupId: string, date: string): string {
  return `${groupId}_${date}`
}

/** Absent without notice counts toward pay by default; an excused absence does not. */
export function defaultBillable(status: AttendanceStatus): boolean {
  return status !== 'e'
}

/** One tap on Today: give every student in the lesson the same status. */
export function quickRecord(
  occ: Occurrence,
  group: Group,
  status: AttendanceStatus,
  existing: Session | undefined,
  now: number,
): SessionInput {
  const attendance = Object.fromEntries(group.studentIds.map((id) => [id, { status, billable: defaultBillable(status) }]))
  return {
    groupId: occ.groupId,
    date: occ.date,
    time: occ.time,
    kind: existing?.kind ?? occ.kind,
    attendance,
    ...(existing?.actualDurationMin !== undefined ? { actualDurationMin: existing.actualDurationMin } : {}),
    ...((existing?.makeupFor ?? occ.makeupFor) ? { makeupFor: existing?.makeupFor ?? occ.makeupFor } : {}),
    ...(existing?.notes ? { notes: existing.notes } : {}),
    ...(existing?.sent ? { sent: existing.sent } : {}),
    updatedAt: now,
  }
}

/** The common status of a lesson, or 'mixed' when students differ, or undefined if none recorded. */
export function lessonStatus(s: Session | undefined): AttendanceStatus | 'mixed' | undefined {
  if (!s) return undefined
  const all = new Set(Object.values(s.attendance).map((a) => a.status))
  if (all.size === 0) return undefined
  return all.size === 1 ? [...all][0] : 'mixed'
}

export function cancelLesson(g: Group, date: string, by: CancelledBy): Record<string, GroupException> {
  return { ...g.exceptions, [date]: { type: 'cancel', by } }
}

export function moveLesson(g: Group, fromDate: string, toDate: string, toTime: string): Record<string, GroupException> {
  return { ...g.exceptions, [fromDate]: { type: 'move', toDate, toTime } }
}

/** Removes the exception on `date` (undo a cancel, a move, or an extra lesson). */
export function restoreLesson(g: Group, date: string): Record<string, GroupException> {
  const next = { ...g.exceptions }
  delete next[date]
  return next
}

/** Lessons that already started (within `days` back) but have no attendance yet: newest day first, each day in time order. */
export function unrecordedLessons(
  groups: Group[],
  sessions: Session[],
  today: string,
  nowTime: string,
  days: number,
  /** Lessons before this date (per group) are treated as settled and left out. */
  since: (groupId: string) => string | undefined = () => undefined,
): Occurrence[] {
  const recorded = new Set(sessions.map((s) => s.id))
  const out: Occurrence[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i)
    for (const o of occurrencesOn(groups, date)) {
      if (o.cancelledBy) continue
      if (date === today && o.time > nowTime) continue
      const start = since(o.groupId)
      if (start && date < start) continue
      if (!recorded.has(sessionId(o.groupId, date))) out.push(o)
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time))
}
