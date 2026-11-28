export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday
export type LessonKind = 'regular' | 'makeup' | 'trial'
export type CancelledBy = 'student' | 'teacher'

export type Slot = { weekday: Weekday; time: string } // time = "HH:mm"

export type GroupException =
  | { type: 'cancel'; by: CancelledBy }
  | { type: 'move'; toDate: string; toTime: string }
  | { type: 'extra'; time: string; kind: LessonKind; makeupFor?: string }

export type Group = {
  id: string
  name?: string
  studentIds: string[]
  startDate: string // "YYYY-MM-DD"
  endDate?: string
  slots: Slot[]
  durationMin: number
  pausedMonths: string[] // "YYYY-MM"
  exceptions: Record<string, GroupException> // keyed by "YYYY-MM-DD"
  archived: boolean
  /** A one-off trial lesson (no weekly days); `paid` = it counts in the dues. */
  trial?: { paid: boolean }
}

export type GroupInput = Omit<Group, 'id'>

/** One lesson on one day, after applying the schedule and its exceptions. */
export type Occurrence = {
  groupId: string
  date: string
  time: string
  durationMin: number
  kind: LessonKind
  cancelledBy?: CancelledBy
  movedFrom?: string
  makeupFor?: string
}

export const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

export function weekdayOf(date: string): Weekday {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Today's date as "YYYY-MM-DD" on this device's clock. */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function occurrencesOn(groups: Group[], date: string): Occurrence[] {
  const out: Occurrence[] = []
  const wd = weekdayOf(date)
  const month = date.slice(0, 7)

  for (const g of groups) {
    if (g.archived) continue
    const base = { groupId: g.id, date, durationMin: g.durationMin }
    const ex = g.exceptions[date]
    const scheduled =
      g.startDate <= date && (!g.endDate || date <= g.endDate) && !g.pausedMonths.includes(month)

    if (scheduled && ex?.type !== 'move') {
      for (const s of g.slots) {
        if (s.weekday !== wd) continue
        out.push({ ...base, time: s.time, kind: 'regular', ...(ex?.type === 'cancel' ? { cancelledBy: ex.by } : {}) })
      }
    }

    if (ex?.type === 'extra') {
      out.push({ ...base, time: ex.time, kind: ex.kind, ...(ex.makeupFor ? { makeupFor: ex.makeupFor } : {}) })
    }

    for (const [from, e] of Object.entries(g.exceptions)) {
      if (e.type === 'move' && e.toDate === date) out.push({ ...base, time: e.toTime, kind: 'regular', movedFrom: from })
    }
  }

  return out.sort((a, b) => a.time.localeCompare(b.time))
}

/** Offset of a time zone from UTC at a given instant, in minutes. */
function tzOffsetMinutes(instant: number, timeZone: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((asUtc - instant) / 60000)
}

/** The instant at which the wall-clock `date time` happens in `timeZone`. */
export function zonedInstant(date: string, time: string, timeZone: string): number {
  const [y, m, d] = parts(date)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - tzOffsetMinutes(guess, timeZone) * 60000
  return guess - tzOffsetMinutes(first, timeZone) * 60000
}

/** The teacher's lesson time expressed on the student's clock, as "HH:mm". */
export function studentLocalTime(date: string, time: string, teacherTz: string, studentTz: string): string {
  const instant = zonedInstant(date, time, teacherTz)
  return new Intl.DateTimeFormat('en-GB', { timeZone: studentTz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(instant),
  )
}

/** "17:00" → "٥:٠٠ م" */
export function time12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h < 12 ? 'ص' : 'م'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

/** Saturday-first week order, as Egyptian calendars show it. */
export const WEEK_ORDER: Weekday[] = [6, 0, 1, 2, 3, 4, 5]

export function scheduleText(slots: Slot[]): string {
  return [...slots]
    .sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday) || a.time.localeCompare(b.time))
    .map((s) => `${WEEKDAY_NAMES[s.weekday]} ${time12(s.time)}`)
    .join('، ')
}

export function groupTitle(g: Pick<Group, 'name' | 'studentIds'>, students: { id: string; name: string }[]): string {
  if (g.name?.trim()) return g.name.trim()
  const names = g.studentIds.map((id) => students.find((s) => s.id === id)?.name).filter(Boolean) as string[]
  if (names.length === 0) return 'حلقة بدون طلاب'
  if (names.length <= 2) return names.join(' و')
  const rest = String(names.length - 2).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
  return `${names[0]} و${names[1]} و${rest} آخر`
}

export type GroupErrors = Partial<Record<'studentIds' | 'slots' | 'durationMin' | 'startDate', string>>

export function validateGroup(g: GroupInput): GroupErrors {
  const e: GroupErrors = {}
  if (g.studentIds.length === 0) e.studentIds = 'اختر طالبًا واحدًا على الأقل.'
  if (g.slots.length === 0) e.slots = 'اختر يومًا واحدًا على الأقل.'
  else if (g.slots.some((s) => !/^\d{2}:\d{2}$/.test(s.time))) e.slots = 'حدد الوقت لكل يوم مختار.'
  if (!(g.durationMin > 0)) e.durationMin = 'اختر مدة الحصة.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.startDate)) e.startDate = 'اختر تاريخ البداية.'
  return e
}

/** "2026-11" + 1 → "2026-12" */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 7)
}

const monthFmt = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "2026-11" → "نوفمبر ٢٠٢٦" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1))).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

/** Saturday on or before the date (Egyptian weeks start on Saturday). */
export function weekStart(date: string): string {
  return addDays(date, -WEEK_ORDER.indexOf(weekdayOf(date)))
}

/** The 7 dates of the date's week, Saturday first. */
export function weekDates(date: string): string[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Calendar grid for a month: whole weeks (Saturday first) covering every day of it. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const start = weekStart(first)
  const last = addDays(addMonths(month, 1) + '-01', -1)
  const end = addDays(weekStart(last), 6)
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}
