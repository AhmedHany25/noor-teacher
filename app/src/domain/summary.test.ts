import { describe, expect, it } from 'vitest'
import type { Session } from './attendance'
import { teacherMonth } from './summary'

const ses = (id: string, date: string, att: Session['attendance'], over: Partial<Session> = {}): Session => ({
  id,
  groupId: 'g1',
  date,
  time: '17:00',
  kind: 'regular',
  attendance: att,
  updatedAt: 1,
  ...over,
})

describe('teacherMonth', () => {
  it('sums lessons held, hours, students, earnings and payments for the month', () => {
    const m = teacherMonth({
      students: [
        { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 },
        { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1, rate: 100 },
      ],
      academies: [{ id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }],
      groups: [{ id: 'g1', studentIds: ['s1', 's2'], startDate: '2026-11-01', slots: [], durationMin: 30, pausedMonths: [], exceptions: {}, archived: false }],
      sessions: [
        ses('x1', '2026-11-06', { s1: { status: 'p', billable: true }, s2: { status: 'p', billable: true } }),
        ses('x2', '2026-11-13', { s1: { status: 'a', billable: true }, s2: { status: 'a', billable: false } }),
        ses('x3', '2026-11-20', { s1: { status: 'p', billable: true } }, { actualDurationMin: 45 }),
        ses('x4', '2026-10-30', { s1: { status: 'p', billable: true } }),
      ],
      payments: [{ id: 'p1', payerKey: 'a1', amount: 80, currency: 'ريال', date: '2026-11-15', resetsCycle: true }],
      baseCurrency: 'جنيه',
      month: '2026-11',
    })
    expect(m).toMatchObject({
      lessons: 2,
      minutes: 75,
      students: 2,
      earned: [
        { currency: 'ريال', amount: 120 },
        { currency: 'جنيه', amount: 100 },
      ],
      received: [{ currency: 'ريال', amount: 80 }],
    })
  })
})
