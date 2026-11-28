import { describe, expect, it } from 'vitest'
import type { Academy } from './academy'
import type { Session } from './attendance'
import { balances, batchStart, cycleTarget, groupBatchStart, monthDues, payerBatch, payerKey, type Payment } from './dues'
import type { Group } from './schedule'
import type { Student } from './student'

const furqan: Academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }
const huda: Academy = { id: 'a2', name: 'الهدى', currency: 'دولار', payMode: 'hour', rate: 10, archived: false }

const stu = (id: string, over: Partial<Student> = {}): Student => ({
  id,
  name: id,
  academyId: 'a1',
  status: 'active',
  createdAt: 1,
  ...over,
})

const group = (id: string, studentIds: string[], durationMin = 30): Group => ({
  id,
  studentIds,
  startDate: '2026-01-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin,
  pausedMonths: [],
  exceptions: {},
  archived: false,
})

let n = 0
const ses = (groupId: string, date: string, att: Session['attendance'], over: Partial<Session> = {}): Session => ({
  id: `${groupId}_${date}_${n++}`,
  groupId,
  date,
  time: '17:00',
  kind: 'regular',
  attendance: att,
  updatedAt: 1,
  ...over,
})

const P = { status: 'p' as const, billable: true }
const A_PAID = { status: 'a' as const, billable: true }
const E_FREE = { status: 'e' as const, billable: false }

describe('monthDues', () => {
  it('pays per billable lesson in the academy currency', () => {
    const d = monthDues({
      students: [stu('s1')],
      academies: [furqan],
      groups: [group('g1', ['s1'])],
      sessions: [
        ses('g1', '2026-11-06', { s1: P }),
        ses('g1', '2026-11-13', { s1: A_PAID }),
        ses('g1', '2026-11-20', { s1: E_FREE }),
        ses('g1', '2026-10-30', { s1: P }), // other month
      ],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ key: 'a1', name: 'الفرقان', currency: 'ريال', total: 80 })
    expect(d[0].lines).toEqual([{ studentId: 's1', name: 's1', mode: 'session', rate: 40, lessons: 2, minutes: 60, amount: 80 }])
  })

  it('pays per hour using the actual duration when recorded', () => {
    const d = monthDues({
      students: [stu('s1', { academyId: 'a2' })],
      academies: [huda],
      groups: [group('g1', ['s1'], 30)],
      sessions: [ses('g1', '2026-11-06', { s1: P }), ses('g1', '2026-11-13', { s1: P }, { actualDurationMin: 60 })],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(d[0].lines[0]).toMatchObject({ mode: 'hour', minutes: 90, amount: 15 })
  })

  it('pays a monthly student the full amount once there is at least one billable lesson', () => {
    const s1 = stu('s1', { payMode: 'month', rate: 500, academyId: null })
    const base = { students: [s1], academies: [], groups: [group('g1', ['s1'])], baseCurrency: 'جنيه', month: '2026-11' }
    expect(monthDues({ ...base, sessions: [ses('g1', '2026-11-06', { s1: P }), ses('g1', '2026-11-13', { s1: P })] })[0]).toMatchObject({
      key: payerKey(s1),
      name: 's1',
      kind: 'private',
      currency: 'جنيه',
      total: 500,
    })
    expect(monthDues({ ...base, sessions: [ses('g1', '2026-11-06', { s1: E_FREE })] })).toEqual([])
  })

  it('does not pay makeup or trial lessons', () => {
    const d = monthDues({
      students: [stu('s1')],
      academies: [furqan],
      groups: [group('g1', ['s1'])],
      sessions: [ses('g1', '2026-11-06', { s1: P }, { kind: 'makeup' }), ses('g1', '2026-11-07', { s1: P }, { kind: 'trial' })],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(d).toEqual([])
  })

  it('pays a trial lesson only when it was agreed to count', () => {
    const input = (paid: boolean) => ({
      students: [stu('s1')],
      academies: [furqan],
      groups: [{ ...group('t1', ['s1']), slots: [], trial: { paid } }],
      sessions: [ses('t1', '2026-11-07', { s1: P }, { kind: 'trial' })],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(monthDues(input(false))).toEqual([])
    expect(monthDues(input(true))[0].total).toBe(40)
  })

  it('uses a student special rate over the academy rate, and pays each student of a group', () => {
    const d = monthDues({
      students: [stu('s1', { rate: 50 }), stu('s2')],
      academies: [furqan],
      groups: [group('g1', ['s1', 's2'])],
      sessions: [ses('g1', '2026-11-06', { s1: P, s2: P })],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(d[0].lines.map((l) => [l.studentId, l.amount])).toEqual([
      ['s1', 50],
      ['s2', 40],
    ])
    expect(d[0].total).toBe(90)
  })

  it('groups private students under one payer in the base currency', () => {
    const d = monthDues({
      students: [stu('p1', { academyId: null, rate: 100 }), stu('p2', { academyId: null, rate: 150 })],
      academies: [],
      groups: [group('g1', ['p1']), group('g2', ['p2'])],
      sessions: [ses('g1', '2026-11-06', { p1: P }), ses('g2', '2026-11-06', { p2: P })],
      month: '2026-11',
      baseCurrency: 'جنيه',
    })
    expect(d).toHaveLength(2) // each private student is their own payer (parents pay separately)
    expect(d.map((x) => x.total)).toEqual([100, 150])
  })
})

describe('balances and cycle', () => {
  const input = {
    students: [stu('s1')],
    academies: [furqan],
    groups: [group('g1', ['s1'])],
    baseCurrency: 'جنيه',
    sessions: [
      ses('g1', '2026-10-02', { s1: P }),
      ses('g1', '2026-10-09', { s1: P }),
      ses('g1', '2026-11-06', { s1: P }),
    ],
  }
  const paid: Payment = { id: 'p1', payerKey: 'a1', amount: 80, currency: 'ريال', date: '2026-10-31', resetsCycle: true }

  it('outstanding = everything earned minus everything received', () => {
    expect(balances(input, [paid]).get('a1')).toEqual({ earned: 120, received: 80, outstanding: 40 })
  })

})

describe('current batch', () => {
  const P = { status: 'p' as const, billable: true }
  const g = group('g1', ['s1', 's2'], 30)
  const pay = (date: string, over: Partial<Payment> = {}): Payment => ({ id: date, payerKey: 'a1', amount: 80, currency: 'ريال', date, resetsCycle: true, ...over })
  const base = {
    students: [stu('s1'), stu('s2')],
    academies: [{ ...furqan, cycleLessons: 8 }],
    groups: [g],
    sessions: [
      ses('g1', '2026-10-30', { s1: P }),
      ses('g1', '2026-11-06', { s1: P, s2: P }),
      ses('g1', '2026-11-13', { s1: P }),
    ],
    baseCurrency: 'جنيه',
  }

  it('counts lessons after the last payment that closed the batch', () => {
    const b = payerBatch('a1', base, [pay('2026-10-31')])
    expect(b.start).toBe('2026-11-01')
    expect(b.lessons).toBe(3)
    expect(b.total).toBe(120)
    expect(b.lines.map((l) => [l.studentId, l.lessons, l.target])).toEqual([
      ['s1', 2, 8],
      ['s2', 1, 8],
    ])
  })

  it('a partial payment does not close the batch', () => {
    expect(payerBatch('a1', base, [pay('2026-11-07', { resetsCycle: false })]).lessons).toBe(4)
    expect(payerBatch('a1', base, [pay('2026-11-07')]).lessons).toBe(1)
  })

  it('a later payment wins over a start date set by hand', () => {
    const academies = [{ ...base.academies[0], trackFrom: '2026-10-01' }]
    expect(batchStart('a1', academies, [], [pay('2026-11-07')])).toBe('2026-11-08')
    expect(batchStart('a1', academies, [], [pay('2026-09-07')])).toBe('2026-10-01')
  })

  it('adds lessons taken before the app to the batch and to the dues', () => {
    const students = [stu('s1', { openingLessons: { count: 5, date: '2026-11-01', minutes: 150 } }), stu('s2')]
    const b = payerBatch('a1', { ...base, students }, [pay('2026-10-31')])
    expect(b.lines[0].lessons).toBe(7)
    expect(monthDues({ ...base, students, month: '2026-11' })[0].lines[0]).toMatchObject({ lessons: 7, minutes: 210, amount: 280 })
    // once paid, the opening lessons belong to the closed batch
    expect(payerBatch('a1', { ...base, students }, [pay('2026-11-14')]).lessons).toBe(0)
  })

  it('takes the lesson count per batch from the student, then the academy', () => {
    expect(cycleTarget(stu('s1'), [{ ...furqan, cycleLessons: 12 }])).toBe(12)
    expect(cycleTarget(stu('s1', { cycleLessons: 4 }), [{ ...furqan, cycleLessons: 12 }])).toBe(4)
    expect(cycleTarget(stu('s1'), [furqan])).toBeUndefined()
  })
})

describe('batch start', () => {
  const pay = (key: string, date: string): Payment => ({ id: key + date, payerKey: key, amount: 1, currency: 'ريال', date, resetsCycle: true })

  it('starts the day after the last payment, or at a date set by hand', () => {
    expect(batchStart('a1', [furqan], [], [pay('a1', '2026-10-31'), pay('a1', '2026-09-30')])).toBe('2026-11-01')
    expect(batchStart('a1', [{ ...furqan, trackFrom: '2026-11-15' }], [], [pay('a1', '2026-10-31')])).toBe('2026-11-15')
    expect(batchStart('a1', [furqan], [], [])).toBeUndefined()
  })

  it('uses a private student own start date', () => {
    const p = stu('p1', { academyId: null, trackFrom: '2026-11-10' })
    expect(batchStart(payerKey(p), [], [p], [])).toBe('2026-11-10')
  })

  it('gives a group the earliest start of its students, or none if one has no start', () => {
    const a = stu('s1')
    const b = stu('s2', { academyId: null, trackFrom: '2026-10-20' })
    const payments = [pay('a1', '2026-10-31')]
    expect(groupBatchStart(group('g', ['s1', 's2']), [a, b], [furqan], payments)).toBe('2026-10-20')
    expect(groupBatchStart(group('g', ['s1', 's3']), [a, stu('s3', { academyId: null })], [furqan], payments)).toBeUndefined()
  })
})
