import type { Academy } from './academy'
import { sessionId, type Session } from './attendance'
import { groupTitle, occurrencesOn, time12, type Group } from './schedule'
import { studentRemindersFor } from './studentReminders'
import type { Student } from './student'

/** The teacher's reminder choices, stored on users/{uid}.notify. Times are Egypt time, "HH:mm". */
export type NotifySettings = {
  beforeOn: boolean
  beforeMinutes: number
  eodOn: boolean
  eodTime: string
  morningOn: boolean
  morningTime: string
  /** Remind private students' families this many hours before a lesson; 0 = off. */
  privateRemindHours?: number
}

export const DEFAULT_NOTIFY: NotifySettings = {
  beforeOn: true,
  beforeMinutes: 15,
  eodOn: true,
  eodTime: '21:00',
  morningOn: false,
  morningTime: '08:00',
}

export type Reminder = { key: string; title: string; body: string; url: string }

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])
const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
/** «حصة واحدة», «حصتين», «٣ حصص», «١١ حصة». */
const lessonsCount = (n: number) => (n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتين' : `${ar(n)} ${n <= 10 ? 'حصص' : 'حصة'}`)
const minutesWord = (n: number) => (n >= 3 && n <= 10 ? 'دقائق' : 'دقيقة')

/**
 * Reminders that are due now and not sent yet. Pure: the sender runs it every few minutes
 * with the teacher's data for today and the keys it already sent.
 */
export function dueReminders(input: {
  today: string
  nowTime: string
  groups: Group[]
  students: Student[]
  sessions: Session[]
  settings: NotifySettings
  sent: Set<string>
  /** For student reminders: the academies (their reminder hours) and the reminders already sent from the app. */
  academies?: Academy[]
  marked?: Set<string>
}): Reminder[] {
  const { today, nowTime, groups, students, sessions, settings, sent, academies = [], marked = new Set<string>() } = input
  const now = minutesOf(nowTime)
  const lessons = occurrencesOn(groups, today).filter((o) => !o.cancelledBy)
  const title = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId)
    return g ? groupTitle(g, students) : ''
  }
  const out: Reminder[] = []

  if (settings.beforeOn) {
    for (const o of lessons) {
      const wait = minutesOf(o.time) - now
      const key = `before:${o.groupId}:${today}:${o.time}`
      if (wait < 0 || wait > settings.beforeMinutes || sent.has(key)) continue
      out.push({
        key,
        title: wait === 0 ? `حصة ${title(o.groupId)} دلوقتي` : `حصة ${title(o.groupId)} بعد ${ar(wait)} ${minutesWord(wait)}`,
        body: `الساعة ${time12(o.time)}، ${ar(o.durationMin)} دقيقة`,
        url: `/lessons/${o.groupId}/${today}`,
      })
    }
  }

  if (settings.eodOn && now >= minutesOf(settings.eodTime) && !sent.has(`eod:${today}`)) {
    const recorded = new Set(sessions.map((s) => s.id))
    const missing = lessons.filter((o) => minutesOf(o.time) <= now && !recorded.has(sessionId(o.groupId, today)))
    if (missing.length) {
      out.push({
        key: `eod:${today}`,
        title: `فاضل ${lessonsCount(missing.length)} النهارده متسجلتش`,
        body: missing.map((o) => title(o.groupId)).join('، '),
        url: '/',
      })
    }
  }

  if (settings.morningOn && now >= minutesOf(settings.morningTime) && now < 12 * 60 && !sent.has(`morning:${today}`) && lessons.length) {
    out.push({
      key: `morning:${today}`,
      title: `عندك ${lessonsCount(lessons.length)} النهارده`,
      body: lessons
        .slice(0, 5)
        .map((o) => `${title(o.groupId)} ${time12(o.time)}`)
        .join('، '),
      url: '/',
    })
  }

  // Time to remind a student's family (academies that require it): nudge the teacher.
  for (const r of studentRemindersFor({ today, groups, students, academies, privateHours: settings.privateRemindHours ?? 0 })) {
    const key = `student:${r.key}`
    const started = r.date === today && r.time <= nowTime
    if (r.dueTime > nowTime || started || sent.has(key) || marked.has(r.key)) continue
    const name = students.find((s) => s.id === r.studentId)?.name ?? ''
    out.push({
      key,
      title: `ذكّر ${name} بحصة ${r.date === today ? '' : 'بكرة '}الساعة ${time12(r.time)}`,
      body: 'افتح التطبيق وابعت التذكير لولي الأمر على واتساب بضغطة.',
      url: '/',
    })
  }

  return out
}
