import { lessonStatus, sessionId, type Session } from './attendance'
import { addDays, occurrencesOn, weekStart, type Group, type Occurrence } from './schedule'
import type { Student } from './student'

export type LessonState = 'none' | 'upcoming' | 'p' | 'a' | 'e' | 'mixed' | 'cancelled'

export type ListedLesson = { o: Occurrence; session?: Session; state: LessonState }

export const STATE_TEXT: Record<LessonState, string> = {
  none: 'لم تُسجَّل',
  upcoming: 'جاية',
  p: 'حضر',
  a: 'غاب',
  e: 'اعتذر',
  mixed: 'مختلط',
  cancelled: 'ملغاة',
}

export type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

/** Date range (inclusive, "YYYY-MM-DD") for a preset, around `today`. */
export function presetRange(preset: Preset, today: string, custom?: { from: string; to: string }): { from: string; to: string } {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { from: y, to: y }
    }
    case 'week': {
      const start = weekStart(today)
      return { from: start, to: addDays(start, 6) }
    }
    case 'month': {
      const from = `${today.slice(0, 7)}-01`
      const [y, m] = today.split('-').map(Number)
      return { from, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
    }
    case 'custom':
      return custom && custom.from <= custom.to ? custom : { from: today, to: today }
  }
}

/**
 * Every lesson between two dates with its recorded state, newest day first and each day in time order.
 * Unrecorded lessons that have not started yet (after `now`) are «upcoming», not «none».
 */
export function lessonsInRange(
  groups: Group[],
  sessions: Session[],
  from: string,
  to: string,
  now?: { today: string; time: string },
): ListedLesson[] {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const out: ListedLesson[] = []
  for (let d = to; d >= from; d = addDays(d, -1)) {
    for (const o of occurrencesOn(groups, d)) {
      const session = byId.get(sessionId(o.groupId, d))
      const st = lessonStatus(session)
      const notYet = !!now && (d > now.today || (d === now.today && o.time > now.time))
      out.push({ o, session, state: o.cancelledBy ? 'cancelled' : (st ?? (notYet ? 'upcoming' : 'none')) })
    }
  }
  return out
}

export type ListFilter = { studentId?: string; payer?: string; state?: LessonState }

/** `payer` is an academy id, or "private" for students without an academy. */
export function filterLessons(list: ListedLesson[], groups: Group[], students: Student[], f: ListFilter): ListedLesson[] {
  return list.filter(({ o, state }) => {
    const g = groups.find((x) => x.id === o.groupId)
    if (!g) return false
    if (f.state && state !== f.state) return false
    if (f.studentId && !g.studentIds.includes(f.studentId)) return false
    if (f.payer) {
      const members = g.studentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is Student => !!s)
      const match = members.some((s) => (f.payer === 'private' ? !s.academyId : s.academyId === f.payer))
      if (!match) return false
    }
    return true
  })
}

export function countStates(list: ListedLesson[]): Record<LessonState, number> & { total: number } {
  const c = { none: 0, upcoming: 0, p: 0, a: 0, e: 0, mixed: 0, cancelled: 0, total: list.length }
  for (const x of list) c[x.state]++
  return c
}

export type StudentAttendanceRow = { studentId: string; name: string; p: number; a: number; e: number; none: number; rate?: number }

/** Per-student attendance for a list of lessons (cancelled and upcoming ones are left out). */
export function attendanceByStudent(list: ListedLesson[], groups: Group[], students: Student[]): StudentAttendanceRow[] {
  const rows = new Map<string, StudentAttendanceRow>()
  for (const { o, session, state } of list) {
    if (state === 'cancelled' || state === 'upcoming') continue
    const g = groups.find((x) => x.id === o.groupId)
    for (const sid of g?.studentIds ?? []) {
      const s = students.find((x) => x.id === sid)
      if (!s) continue
      const row = rows.get(sid) ?? { studentId: sid, name: s.name, p: 0, a: 0, e: 0, none: 0 }
      const st = session?.attendance[sid]?.status
      if (st) row[st]++
      else row.none++
      rows.set(sid, row)
    }
  }
  return [...rows.values()]
    .map((r) => {
      const recorded = r.p + r.a + r.e
      return recorded ? { ...r, rate: Math.round((r.p / recorded) * 100) } : r
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

/** CSV (with BOM, for Excel) of the attendance report. */
export function attendanceCsv(rows: StudentAttendanceRow[], from: string, to: string): string {
  const head = ['من', 'إلى', 'الطالب', 'حضر', 'غاب', 'اعتذر', 'لم تُسجَّل', 'نسبة الحضور']
  const lines = rows.map((r) => [from, to, r.name, r.p, r.a, r.e, r.none, r.rate === undefined ? '' : `${r.rate}%`].join(','))
  return '\uFEFF' + [head.join(','), ...lines].join('\r\n')
}
