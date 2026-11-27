import type { Session } from './attendance'
import { monthDues, type DuesInput, type Payment, type PayerDues } from './dues'

export type TeacherMonth = {
  /** Lessons held (at least one student attended). */
  lessons: number
  minutes: number
  /** Distinct students who attended at least once. */
  students: number
  earned: { currency: string; amount: number }[]
  received: { currency: string; amount: number }[]
  payers: PayerDues[]
}

function perCurrency(items: { currency: string; amount: number }[]) {
  const m = new Map<string, number>()
  for (const x of items) m.set(x.currency, Math.round(((m.get(x.currency) ?? 0) + x.amount) * 100) / 100)
  return [...m].map(([currency, amount]) => ({ currency, amount }))
}

/** The teacher's own month: work done and money earned and received. */
export function teacherMonth(input: DuesInput & { payments: Payment[]; month: string }): TeacherMonth {
  const held = input.sessions.filter((s: Session) => s.date.startsWith(input.month) && Object.values(s.attendance).some((a) => a.status === 'p'))
  const minutes = held.reduce((n, s) => n + (s.actualDurationMin ?? input.groups.find((g) => g.id === s.groupId)?.durationMin ?? 0), 0)
  const attended = new Set(held.flatMap((s) => Object.entries(s.attendance).filter(([, a]) => a.status === 'p').map(([id]) => id)))
  const payers = monthDues(input)
  return {
    lessons: held.length,
    minutes,
    students: attended.size,
    earned: perCurrency(payers.map((p) => ({ currency: p.currency, amount: p.total }))),
    received: perCurrency(input.payments.filter((p) => p.date.startsWith(input.month))),
    payers,
  }
}
