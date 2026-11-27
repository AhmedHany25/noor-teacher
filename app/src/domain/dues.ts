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
  resetsCycle: boolean // this was the cycle's salary: restart the lesson counters
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

export const DEFAULT_CYCLE_TARGET = 8

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

/** Billable regular lessons of one student, grouped by month ("YYYY-MM"). */
function billableByMonth(studentId: string, sessions: Session[], groups: Group[]) {
  const byMonth = new Map<string, { lessons: number; minutes: number }>()
  for (const s of sessions) {
    if (s.kind !== 'regular') continue
    const a = s.attendance[studentId]
    if (!a?.billable) continue
    const minutes = s.actualDurationMin ?? groups.find((g) => g.id === s.groupId)?.durationMin ?? 0
    const m = s.date.slice(0, 7)
    const cur = byMonth.get(m) ?? { lessons: 0, minutes: 0 }
    byMonth.set(m, { lessons: cur.lessons + 1, minutes: cur.minutes + minutes })
  }
  return byMonth
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
    const m = billableByMonth(s.id, input.sessions, input.groups).get(input.month)
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
    for (const m of billableByMonth(s.id, input.sessions, input.groups).values()) earned += amountFor(mode, rate, m.lessons, m.minutes)
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

/** Billable regular lessons of a student after the payer's last cycle-reset payment. */
export function cycleCount(studentId: string, key: string, sessions: Session[], payments: Payment[]): number {
  const lastReset = payments
    .filter((p) => p.payerKey === key && p.resetsCycle)
    .map((p) => p.date)
    .sort()
    .at(-1)
  return sessions.filter(
    (s) => s.kind === 'regular' && s.attendance[studentId]?.billable && (!lastReset || s.date > lastReset),
  ).length
}
