import type { Academy } from './academy'
import type { AttendanceStatus, Session } from './attendance'
import { monthDues, type Payment } from './dues'
import { weekdayOf, type Group, type GroupException, type LessonKind, type Slot, type Weekday } from './schedule'
import type { PayMode, Student } from './student'

/** Everything a teacher owns, as stored by this app. */
export type BackupData = {
  students: Student[]
  academies: Academy[]
  groups: Group[]
  sessions: Session[]
  payments: Payment[]
  /** Old-site data with no screen yet (plans, progress, marks), kept verbatim. */
  legacy: Record<string, unknown>
}

export type ImportSummary = { students: number; academies: number; groups: number; sessions: number; payments: number }

export type ParseResult =
  | { ok: true; source: 'old' | 'new'; data: BackupData; summary: ImportSummary }
  | { ok: false; error: string }

const APP = 'noor-teacher-app'

export function exportBackup(data: BackupData, now = Date.now()): string {
  return JSON.stringify({ app: APP, v: 1, exportedAt: now, data })
}

function summarize(d: BackupData): ImportSummary {
  return {
    students: d.students.length,
    academies: d.academies.length,
    groups: d.groups.length,
    sessions: d.sessions.length,
    payments: d.payments.length,
  }
}

export function parseBackup(text: string, baseCurrency: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'الملف مش JSON صالح.' }
  }
  const o = raw as Record<string, unknown>
  if (o && o.app === APP && o.data) {
    const data = o.data as BackupData
    return { ok: true, source: 'new', data, summary: summarize(data) }
  }
  const db = (o && typeof o.db === 'object' ? o.db : o) as OldDb
  if (!db || !Array.isArray(db.students) || !Array.isArray(db.groups)) {
    return { ok: false, error: 'الملف مش نسخة احتياطية من نور القرآن.' }
  }
  const data = convertOld(db, baseCurrency)
  return { ok: true, source: 'old', data, summary: summarize(data) }
}

/* ---------- old site format (noor.teacher.v1) ---------- */

type OldStudent = {
  id: string
  name?: string
  phone?: string
  academy?: string
  mode?: string
  rate?: number | string
  level?: string
  age?: number | string
  note?: string
  tz?: string
  status?: string
}
type OldGroup = {
  id: string
  name?: string
  students?: string[]
  date?: string
  time?: string
  dur?: number | string
  repeat?: string
  days?: (string | number)[]
  times?: Record<string, string>
  until?: string
  off?: Record<string, unknown>
  ex?: Record<string, { c?: unknown; paid?: unknown; mv?: string; t?: string }>
  kind?: string
}
type OldAttendance = { st?: Record<string, string>; pay?: Record<string, unknown>; dur?: number | string; note?: string }
type OldDb = {
  settings?: { currency?: string }
  academies?: { id: string; name?: string; paid?: Record<string, unknown>; arch?: unknown }[]
  students: OldStudent[]
  groups: OldGroup[]
  attendance?: Record<string, OldAttendance>
  plans?: unknown
  progress?: unknown
  marks?: unknown
}

const MODES: PayMode[] = ['session', 'hour', 'month']
const asMode = (m?: string): PayMode => (MODES.includes(m as PayMode) ? (m as PayMode) : 'session')
const asNum = (v: unknown): number | undefined => {
  const n = Number(v)
  return v === undefined || v === '' || !Number.isFinite(n) ? undefined : n
}
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
const isTime = (s: unknown): s is string => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)
const asKind = (k?: string): LessonKind => (k === 'makeup' || k === 'trial' ? k : 'regular')

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** The most common value in a list (first one wins ties). */
function mode<T>(xs: T[]): T | undefined {
  const counts = new Map<string, { v: T; n: number }>()
  for (const x of xs) {
    const k = JSON.stringify(x)
    counts.set(k, { v: x, n: (counts.get(k)?.n ?? 0) + 1 })
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.v
}

function convertOld(db: OldDb, baseCurrency: string): BackupData {
  const currency = db.settings?.currency || baseCurrency
  const oldStudents = db.students.filter((s) => s && s.id)

  // Academies: pay rule = the most common rule among their students.
  const academies: Academy[] = (db.academies ?? [])
    .filter((a) => a && a.id)
    .map((a) => {
      const rules = oldStudents
        .filter((s) => s.academy === a.id)
        .map((s) => ({ mode: asMode(s.mode), rate: asNum(s.rate) ?? 0 }))
      const common = mode(rules) ?? { mode: 'session' as PayMode, rate: 0 }
      return { id: a.id, name: a.name || 'أكاديمية', currency, payMode: common.mode, rate: common.rate, archived: !!a.arch }
    })

  const students: Student[] = oldStudents.map((s) => {
    const academy = academies.find((a) => a.id === s.academy)
    const m = asMode(s.mode)
    const rate = asNum(s.rate)
    const sameAsAcademy = academy && academy.payMode === m && academy.rate === (rate ?? 0)
    const st: Student = {
      id: s.id,
      name: s.name?.trim() || 'بدون اسم',
      academyId: academy ? academy.id : null,
      status: s.status === 'paused' ? 'paused' : s.status === 'left' ? 'left' : 'active',
      createdAt: 0,
    }
    if (s.phone?.trim()) st.guardianPhone = s.phone.trim()
    if (s.tz) st.timeZone = s.tz
    if (s.level?.trim()) st.level = s.level.trim()
    const age = asNum(s.age)
    if (age) st.age = age
    if (s.note?.trim()) st.notes = s.note.trim()
    if (!sameAsAcademy) {
      if (!academy || m !== academy.payMode) st.payMode = m
      if (rate !== undefined) st.rate = rate
    }
    return st
  })

  const groups: Group[] = []
  const sessions: Session[] = []
  const att = db.attendance ?? {}

  for (const g of db.groups) {
    if (!g || !g.id || !isDate(g.date)) continue
    const durationMin = asNum(g.dur) ?? 30
    const baseTime = isTime(g.time) ? g.time : '17:00'
    const once = g.repeat !== 'weekly'
    const days: Weekday[] = once
      ? [weekdayOf(g.date)]
      : (g.days?.length ? g.days.map((d) => Number(d) as Weekday) : [weekdayOf(g.date)])
    const slots: Slot[] = days.map((d) => ({ weekday: d, time: isTime(g.times?.[d]) ? g.times![d] : baseTime }))
    const timeOn = (date: string) => slots.find((s) => s.weekday === weekdayOf(date))?.time ?? baseTime

    const exceptions: Record<string, GroupException> = {}
    for (const [date, e] of Object.entries(g.ex ?? {})) {
      if (!isDate(date) || !e) continue
      if (e.mv && isDate(e.mv)) exceptions[date] = { type: 'move', toDate: e.mv, toTime: isTime(e.t) ? e.t : timeOn(date) }
      else if (e.c && e.paid) {
        // Old "cancelled but paid": keep the money as a billable excused lesson.
        sessions.push({
          id: `${g.id}_${date}`,
          groupId: g.id,
          date,
          time: timeOn(date),
          kind: asKind(g.kind),
          attendance: Object.fromEntries((g.students ?? []).map((sid) => [sid, { status: 'e' as const, billable: true }])),
          updatedAt: 0,
        })
      } else if (e.c) exceptions[date] = { type: 'cancel', by: 'student' }
    }

    const group: Group = {
      id: g.id,
      studentIds: (g.students ?? []).filter((id) => students.some((s) => s.id === id)),
      startDate: g.date,
      slots,
      durationMin,
      pausedMonths: Object.keys(g.off ?? {}).filter((m) => /^\d{4}-\d{2}$/.test(m)),
      exceptions,
      archived: false,
    }
    if (g.name?.trim()) group.name = g.name.trim()
    if (once) group.endDate = g.date
    else if (isDate(g.until)) group.endDate = g.until
    groups.push(group)
  }

  for (const [key, r] of Object.entries(att)) {
    const [gid, date] = key.split('|')
    const g = db.groups.find((x) => x.id === gid)
    if (!g || !isDate(date) || !r?.st) continue
    const attendance: Session['attendance'] = {}
    for (const [sid, v] of Object.entries(r.st)) {
      if (v !== 'p' && v !== 'a' && v !== 'e') continue
      attendance[sid] = { status: v as AttendanceStatus, billable: v === 'p' || !!r.pay?.[sid] }
    }
    if (!Object.keys(attendance).length) continue
    const group = groups.find((x) => x.id === gid)
    const time = group ? (group.slots.find((s) => s.weekday === weekdayOf(date))?.time ?? group.slots[0].time) : '17:00'
    const s: Session = { id: `${gid}_${date}`, groupId: gid, date, time, kind: asKind(g.kind), attendance, updatedAt: 0 }
    const dur = asNum(r.dur)
    if (dur && dur !== (asNum(g.dur) ?? 30)) s.actualDurationMin = dur
    if (r.note?.trim()) s.note = r.note.trim()
    const i = sessions.findIndex((x) => x.id === s.id)
    if (i >= 0) sessions[i] = s
    else sessions.push(s)
  }

  // Months the old site marked "paid": record them as received payments of that month's dues.
  const payments: Payment[] = []
  for (const a of db.academies ?? []) {
    for (const month of Object.keys(a.paid ?? {}).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort()) {
      const due = monthDues({ students, academies, groups, sessions, baseCurrency: currency, month }).find((p) => p.key === a.id)
      if (!due?.total) continue
      payments.push({
        id: `old-${a.id}-${month}`,
        payerKey: a.id,
        amount: due.total,
        currency: due.currency,
        date: lastDayOfMonth(month),
        resetsCycle: true,
        note: 'من الموقع القديم',
      })
    }
  }

  const legacy: Record<string, unknown> = {}
  for (const k of ['plans', 'progress', 'marks'] as const) {
    const v = db[k]
    if (v && (Array.isArray(v) ? v.length : Object.keys(v).length)) legacy[k] = v
  }

  return { students, academies, groups, sessions, payments, legacy }
}
