import { describe, expect, it } from 'vitest'
import {
  cancelLesson,
  defaultBillable,
  moveLesson,
  quickRecord,
  restoreLesson,
  sessionId,
  unrecordedLessons,
  type Session,
} from './attendance'
import type { Group } from './schedule'

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }], // Fridays
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

const FRI = '2026-11-27'

describe('defaultBillable', () => {
  it('counts present and absent lessons, not excused ones', () => {
    expect(defaultBillable('p')).toBe(true)
    expect(defaultBillable('a')).toBe(true)
    expect(defaultBillable('e')).toBe(false)
  })
})

describe('quickRecord', () => {
  const occ = { groupId: 'g1', date: FRI, time: '17:00', durationMin: 30, kind: 'regular' as const }

  it('records one status for every student of the lesson with default billing', () => {
    const s = quickRecord(occ, group({ studentIds: ['s1', 's2'] }), 'a', undefined, 1000)
    expect(s).toEqual({
      groupId: 'g1',
      date: FRI,
      time: '17:00',
      kind: 'regular',
      attendance: { s1: { status: 'a', billable: true }, s2: { status: 'a', billable: true } },
      updatedAt: 1000,
    })
  })

  it('keeps the actual duration and makeup link of an existing record', () => {
    const existing: Session = {
      id: sessionId('g1', FRI),
      groupId: 'g1',
      date: FRI,
      time: '17:00',
      kind: 'makeup',
      makeupFor: '2026-11-20',
      actualDurationMin: 45,
      attendance: { s1: { status: 'p', billable: true } },
      updatedAt: 1,
    }
    const s = quickRecord(occ, group(), 'e', existing, 2)
    expect(s).toMatchObject({ actualDurationMin: 45, makeupFor: '2026-11-20', kind: 'makeup' })
    expect(s.attendance.s1).toEqual({ status: 'e', billable: false })
  })
})

describe('lesson exceptions', () => {
  it('cancels and restores a lesson', () => {
    const cancelled = cancelLesson(group(), FRI, 'teacher')
    expect(cancelled[FRI]).toEqual({ type: 'cancel', by: 'teacher' })
    expect(restoreLesson({ ...group(), exceptions: cancelled }, FRI)).toEqual({})
  })

  it('moves a lesson; restoring the original date undoes the move', () => {
    const moved = moveLesson(group(), FRI, '2026-11-28', '20:00')
    expect(moved[FRI]).toEqual({ type: 'move', toDate: '2026-11-28', toTime: '20:00' })
    expect(restoreLesson({ ...group(), exceptions: moved }, FRI)).toEqual({})
  })
})

describe('unrecordedLessons', () => {
  const sessions: Session[] = [
    {
      id: sessionId('g1', '2026-11-20'),
      groupId: 'g1',
      date: '2026-11-20',
      time: '17:00',
      kind: 'regular',
      attendance: { s1: { status: 'p', billable: true } },
      updatedAt: 1,
    },
  ]

  it('lists past lessons with no attendance, newest first, excluding cancelled ones', () => {
    const g = group({ exceptions: { '2026-11-13': { type: 'cancel', by: 'student' } } })
    const list = unrecordedLessons([g], sessions, FRI, '18:00', 60)
    expect(list.map((o) => o.date)).toEqual([FRI, '2026-11-06'])
  })

  it('ignores today’s lessons that have not started yet', () => {
    const list = unrecordedLessons([group()], sessions, FRI, '10:00', 60)
    expect(list.map((o) => o.date)).not.toContain(FRI)
  })

  it('only looks back the given number of days', () => {
    const list = unrecordedLessons([group()], sessions, FRI, '18:00', 7)
    expect(list.map((o) => o.date)).toEqual([FRI])
  })
})

describe('unrecordedLessons with a batch start', () => {
  it('leaves out lessons before the start of the current batch', () => {
    const list = unrecordedLessons([group()], [], FRI, '18:00', 60, () => '2026-11-15')
    expect(list.map((o) => o.date)).toEqual([FRI, '2026-11-20'])
  })
})
