import { describe, expect, it } from 'vitest'
import type { Session } from './attendance'
import { attendanceByStudent, attendanceCsv, countStates, filterLessons, lessonsInRange, presetRange } from './attendanceList'
import type { Group } from './schedule'
import type { Student } from './student'

const students: Student[] = [
  { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 },
  { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 },
]
const g = (id: string, sid: string, weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6, over: Partial<Group> = {}): Group => ({
  id,
  studentIds: [sid],
  startDate: '2026-11-01',
  slots: [{ weekday, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})
const groups = [
  g('fri', 's1', 5, { exceptions: { '2026-11-20': { type: 'cancel', by: 'student' } } }),
  g('wed', 's2', 3),
]
const sessions: Session[] = [
  { id: 'fri_2026-11-27', groupId: 'fri', date: '2026-11-27', time: '17:00', kind: 'regular', attendance: { s1: { status: 'p', billable: true } }, updatedAt: 1 },
  { id: 'wed_2026-11-25', groupId: 'wed', date: '2026-11-25', time: '17:00', kind: 'regular', attendance: { s2: { status: 'a', billable: true } }, updatedAt: 1 },
]

describe('presetRange', () => {
  it('works out common ranges around today (Friday 27 Nov 2026)', () => {
    expect(presetRange('today', '2026-11-27')).toEqual({ from: '2026-11-27', to: '2026-11-27' })
    expect(presetRange('yesterday', '2026-11-27')).toEqual({ from: '2026-11-26', to: '2026-11-26' })
    expect(presetRange('week', '2026-11-27')).toEqual({ from: '2026-11-21', to: '2026-11-27' })
    expect(presetRange('month', '2026-11-27')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(presetRange('custom', '2026-11-27', { from: '2026-11-10', to: '2026-11-12' })).toEqual({ from: '2026-11-10', to: '2026-11-12' })
  })
})

describe('upcoming lessons', () => {
  it('marks unrecorded lessons that have not started yet as upcoming', () => {
    const list = lessonsInRange(groups, [], '2026-11-25', '2026-12-02', { today: '2026-11-27', time: '12:00' })
    expect(list.map((x) => `${x.o.date}:${x.state}`)).toEqual(['2026-12-02:upcoming', '2026-11-27:upcoming', '2026-11-25:none'])
  })
})

describe('lessonsInRange', () => {
  const list = lessonsInRange(groups, sessions, '2026-11-18', '2026-11-27')

  it('lists every lesson newest first with its state', () => {
    expect(list.map((x) => `${x.o.date}:${x.state}`)).toEqual(['2026-11-27:p', '2026-11-25:a', '2026-11-20:cancelled', '2026-11-18:none'])
  })

  it('counts states', () => {
    expect(countStates(list)).toEqual({ total: 4, p: 1, a: 1, e: 0, mixed: 0, none: 1, upcoming: 0, cancelled: 1 })
  })

  it('filters by state, student and payer', () => {
    expect(filterLessons(list, groups, students, { state: 'none' }).map((x) => x.o.date)).toEqual(['2026-11-18'])
    expect(filterLessons(list, groups, students, { studentId: 's1' }).map((x) => x.o.groupId)).toEqual(['fri', 'fri'])
    expect(filterLessons(list, groups, students, { payer: 'private' }).map((x) => x.o.groupId)).toEqual(['wed', 'wed'])
    expect(filterLessons(list, groups, students, { payer: 'a1' })).toHaveLength(2)
  })
})

describe('attendanceByStudent', () => {
  it('counts each student and their attendance rate, skipping cancelled lessons', () => {
    const list = lessonsInRange(groups, sessions, '2026-11-18', '2026-11-27')
    expect(attendanceByStudent(list, groups, students)).toEqual([
      { studentId: 's2', name: 'عمر', p: 0, a: 1, e: 0, none: 1, rate: 0 },
      { studentId: 's1', name: 'يوسف', p: 1, a: 0, e: 0, none: 0, rate: 100 },
    ])
  })

  it('exports a CSV for Excel', () => {
    const csv = attendanceCsv([{ studentId: 's1', name: 'يوسف', p: 3, a: 1, e: 0, none: 0, rate: 75 }], '2026-11-01', '2026-11-30')
    expect(csv.slice(1).split('\r\n')[1]).toBe('2026-11-01,2026-11-30,يوسف,3,1,0,0,75%')
  })
})
