import type { Academy } from './academy'
import type { Session } from './attendance'
import type { Group } from './schedule'
import type { PayMode, Student } from './student'

/** Money received from a payer: an academy, or a private student's family. */
export type Payment = {
  id: string
  payerKey: string // academy id, or `student:<id>` for a private student
  amount: number
  currency: string
  date: string // "YYYY-MM-DD"
  /** Closes the current batch (the counters start again). False = a partial payment. */
  resetsCycle: boolean
  note?: string
}

export type PaymentInput = Omit<Payment, 'id'>

export type DuesLine = {
  studentId: string
  name: string
  mode: PayMode
  rate: number
  lessons: number
  minutes: number
  amount: number
}

export type PayerDues = {
  key: string
  name: string
  kind: 'academy' | 'private'
  currency: string
  lines: DuesLine[]
  total: number
}

export type DuesInput = {
  students: Student[]
  academies: Academy[]
  groups: Group[]
  sessions: Session[]
  baseCurrency: string
}

/** Currency for private students until a profile setting exists. */
export const DEFAULT_BASE_CURRENCY = 'جنيه'

/** Each private student is their own payer (their family pays); academy students share the academy. */
export function payerKey(s: Pick<Student, 'id' | 'academyId'>): string {
  return s.academyId ?? `student:${s.id}`
}

export function payRule(s: Student, academies: Academy[]): { mode: PayMode; rate: number; currency?: string } {
  const a = s.academyId ? academies.find((x) => x.id === s.academyId) : undefined
  return { mode: s.payMode ?? a?.payMode ?? 'session', rate: s.rate ?? a?.rate ?? 0, currency: a?.currency }
}

const round2 = (x: number) => Math.round(x * 100) / 100

type Billable = { date: string; lessons: number; minutes: number }

/** Billable regular lessons of one student (plus lessons taken before the app), optionally from a date on. */
function billable(student: Student, sessions: Session[], groups: Group[], from?: string): Billable[] {
  const out: Billable[] = []
  const o = student.openingLessons
  if (o && o.count > 0 && (!from || o.date >= from)) out.push({ date: o.date, lessons: o.count, minutes: o.minutes })
  for (const s of sessions) {
    if (!s.attendance[student.id]?.billable) continue
    // Regular lessons count; a trial only when it was agreed to be paid.
    if (s.kind !== 'regular' && !(s.kind === 'trial' && groups.find((g) => g.id === s.groupId)?.trial?.paid)) continue
    if (from && s.date < from) continue
    const minutes = s.actualDurationMin ?? groups.find((g) => g.id === s.groupId)?.durationMin ?? 0
    out.push({ date: s.date, lessons: 1, minutes })
  }
  return out
}

/** Billable lessons grouped by month ("YYYY-MM"). */
function byMonth(items: Billable[]) {
  const m = new Map<string, { lessons: number; minutes: number }>()
  for (const b of items) {
    const k = b.date.slice(0, 7)
    const cur = m.get(k) ?? { lessons: 0, minutes: 0 }
    m.set(k, { lessons: cur.lessons + b.lessons, minutes: cur.minutes + b.minutes })
  }
  return m
}

function billableByMonth(student: Student, sessions: Session[], groups: Group[]) {
  return byMonth(billable(student, sessions, groups))
}

function amountFor(mode: PayMode, rate: number, lessons: number, minutes: number): number {
  if (lessons === 0) return 0
  if (mode === 'session') return round2(lessons * rate)
  if (mode === 'hour') return round2((minutes / 60) * rate)
  return rate // month: the full amount once at least one billable lesson happened
}

/** What each payer owes for one month. Payers with nothing due are left out. */
export function monthDues(input: DuesInput & { month: string }): PayerDues[] {
  const payers = new Map<string, PayerDues>()
  const sorted = [...input.students].sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  for (const s of sorted) {
    const { mode, rate, currency } = payRule(s, input.academies)
    const m = billableByMonth(s, input.sessions, input.groups).get(input.month)
    if (!m) continue
    const amount = amountFor(mode, rate, m.lessons, m.minutes)
    const key = payerKey(s)
    const academy = s.academyId ? input.academies.find((a) => a.id === s.academyId) : undefined
    const payer = payers.get(key) ?? {
      key,
      name: academy?.name ?? s.name,
      kind: academy ? ('academy' as const) : ('private' as const),
      currency: currency ?? input.baseCurrency,
      lines: [],
      total: 0,
    }
    payer.lines.push({ studentId: s.id, name: s.name, mode, rate, lessons: m.lessons, minutes: m.minutes, amount })
    payer.total = round2(payer.total + amount)
    payers.set(key, payer)
  }

  return [...payers.values()].sort((a, b) => Number(a.kind === 'private') - Number(b.kind === 'private') || a.name.localeCompare(b.name, 'ar'))
}

/** All-time earned vs received per payer key. */
export function balances(input: DuesInput, payments: Payment[]): Map<string, { earned: number; received: number; outstanding: number }> {
  const out = new Map<string, { earned: number; received: number; outstanding: number }>()
  const get = (k: string) => out.get(k) ?? { earned: 0, received: 0, outstanding: 0 }

  for (const s of input.students) {
    const { mode, rate } = payRule(s, input.academies)
    let earned = 0
    for (const m of billableByMonth(s, input.sessions, input.groups).values()) earned += amountFor(mode, rate, m.lessons, m.minutes)
    if (!earned) continue
    const k = payerKey(s)
    const cur = get(k)
    out.set(k, { ...cur, earned: round2(cur.earned + earned) })
  }
  for (const p of payments) {
    const cur = get(p.payerKey)
    out.set(p.payerKey, { ...cur, received: round2(cur.received + p.amount) })
  }
  for (const [k, v] of out) out.set(k, { ...v, outstanding: round2(v.earned - v.received) })
  return out
}

/** Day after a date string. */
function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/**
 * Start of the payer's current (unpaid) batch: the day after the last payment that closed a batch,
 * or the date set by hand if that is later; undefined when nothing was settled yet.
 */
export function batchStart(key: string, academies: Academy[], students: Student[], payments: Payment[]): string | undefined {
  const manual = academies.find((a) => a.id === key)?.trackFrom ?? students.find((s) => payerKey(s) === key && !s.academyId)?.trackFrom
  const last = payments
    .filter((p) => p.payerKey === key && p.resetsCycle !== false)
    .map((p) => p.date)
    .sort()
    .at(-1)
  const afterPay = last ? nextDay(last) : undefined
  if (manual && afterPay) return manual > afterPay ? manual : afterPay
  return manual ?? afterPay
}

/** How many lessons make one batch for this student: their own setting, else the academy's. */
export function cycleTarget(s: Student, academies: Academy[]): number | undefined {
  const n = s.cycleLessons ?? (s.academyId ? academies.find((a) => a.id === s.academyId)?.cycleLessons : undefined)
  return n && n > 0 ? n : undefined
}

export type BatchLine = { studentId: string; name: string; lessons: number; amount: number; target?: number }
export type PayerBatch = { start?: string; lessons: number; total: number; lines: BatchLine[] }

/** The payer's current unpaid batch: lessons and money per student since the batch started. */
export function payerBatch(key: string, input: DuesInput, payments: Payment[]): PayerBatch {
  const start = batchStart(key, input.academies, input.students, payments)
  const lines: BatchLine[] = []
  const sorted = input.students.filter((s) => payerKey(s) === key).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  for (const s of sorted) {
    const items = billable(s, input.sessions, input.groups, start)
    if (!items.length) continue
    const { mode, rate } = payRule(s, input.academies)
    let amount = 0
    let lessons = 0
    for (const m of byMonth(items).values()) {
      amount += amountFor(mode, rate, m.lessons, m.minutes)
      lessons += m.lessons
    }
    lines.push({ studentId: s.id, name: s.name, lessons, amount: round2(amount), target: cycleTarget(s, input.academies) })
  }
  return {
    start,
    lessons: lines.reduce((n, l) => n + l.lessons, 0),
    total: round2(lines.reduce((n, l) => n + l.amount, 0)),
    lines,
  }
}

/** For a group: the earliest batch start among its students' payers (undefined if any payer has none). */
export function groupBatchStart(
  group: Group,
  students: Student[],
  academies: Academy[],
  payments: Payment[],
): string | undefined {
  const starts = group.studentIds.map((id) => {
    const s = students.find((x) => x.id === id)
    return s ? batchStart(payerKey(s), academies, students, payments) : undefined
  })
  if (starts.length === 0 || starts.some((s) => !s)) return undefined
  return (starts as string[]).sort()[0]
}
