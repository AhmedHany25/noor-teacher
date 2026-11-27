import type { Academy } from './academy'
import { countryOf } from './countries'
import { addDays, occurrencesOn, studentLocalTime, time12, type Group } from './schedule'
import type { Student } from './student'

/** A reminder the teacher should send a student's family before a lesson. */
export type StudentReminder = {
  key: string // `${groupId}:${date}:${time}:${studentId}`
  groupId: string
  studentId: string
  date: string // lesson date
  time: string // lesson time
  hours: number
  /** When to send it, as "HH:mm" today (it may belong to a lesson tomorrow). */
  dueTime: string
}

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Hours before the lesson this student must be reminded, or 0 for none. */
export function remindHoursFor(s: Student, academies: Academy[], privateHours: number): number {
  if (!s.academyId) return privateHours
  return academies.find((a) => a.id === s.academyId)?.remindHours ?? 0
}

/**
 * Reminders whose sending time falls on `today`: lessons later today, or tomorrow's early
 * lessons when the reminder window reaches back into today.
 */
export function studentRemindersFor(input: {
  today: string
  groups: Group[]
  students: Student[]
  academies: Academy[]
  privateHours: number
}): StudentReminder[] {
  const { today, groups, students, academies, privateHours } = input
  const out: StudentReminder[] = []
  for (const [date, dayOffset] of [
    [today, 0],
    [addDays(today, 1), 1],
  ] as const) {
    for (const o of occurrencesOn(groups, date)) {
      if (o.cancelledBy) continue
      const g = groups.find((x) => x.id === o.groupId)
      if (!g) continue
      for (const sid of g.studentIds) {
        const s = students.find((x) => x.id === sid)
        if (!s || s.status !== 'active') continue
        const hours = remindHoursFor(s, academies, privateHours)
        if (!hours) continue
        const due = minutesOf(o.time) + dayOffset * 1440 - hours * 60
        if (due < 0 || due >= 1440) continue // sent on another day
        out.push({ key: `${o.groupId}:${date}:${o.time}:${sid}`, groupId: o.groupId, studentId: sid, date, time: o.time, hours, dueTime: hhmm(due) })
      }
    }
  }
  return out.sort((a, b) => a.dueTime.localeCompare(b.dueTime))
}

/** The WhatsApp reminder to the family, with the student's local time when they live elsewhere. */
export function studentReminderMessage(input: { name: string; date: string; time: string; today: string; teacherTz: string; studentTz?: string }): string {
  const { name, date, time, today, teacherTz, studentTz } = input
  const when = date === today ? 'اليوم' : 'بكرة'
  const local =
    studentTz && studentTz !== teacherTz
      ? `${time12(studentLocalTime(date, time, teacherTz, studentTz))} بتوقيت ${countryOf(studentTz)?.name ?? studentTz}`
      : time12(time)
  return [`السلام عليكم ورحمة الله وبركاته`, `تذكير بحصة ${name} ${when} الساعة ${local} بإذن الله.`, `في انتظاركم 🌿`].join('\n')
}
