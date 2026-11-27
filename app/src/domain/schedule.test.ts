import { describe, expect, it } from 'vitest'
import {
  addDays,
  groupTitle,
  occurrencesOn,
  scheduleText,
  studentLocalTime,
  monthGrid,
  validateGroup,
  weekDates,
  weekStart,
  weekdayOf,
  type Group,
  type GroupInput,
} from './schedule'

const g = (over: Partial<Group>): Group => ({
  id: 'g1',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }], // Friday
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

// 2026-11-27 is a Friday, 2026-11-28 a Saturday.
const FRI = '2026-11-27'
const SAT = '2026-11-28'

describe('date helpers', () => {
  it('finds the weekday of a date string (0 = Sunday)', () => {
    expect(weekdayOf(FRI)).toBe(5)
    expect(weekdayOf('2026-11-29')).toBe(0)
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('occurrencesOn', () => {
  it('returns a weekly lesson on its weekday at its time', () => {
    expect(occurrencesOn([g({})], FRI)).toEqual([
      { groupId: 'g1', date: FRI, time: '17:00', durationMin: 30, kind: 'regular' },
    ])
    expect(occurrencesOn([g({})], SAT)).toEqual([])
  })

  it('supports a different time per day', () => {
    const group = g({ slots: [{ weekday: 5, time: '17:00' }, { weekday: 6, time: '09:30' }] })
    expect(occurrencesOn([group], SAT)[0].time).toBe('09:30')
  })

  it('respects start date, end date and archive', () => {
    expect(occurrencesOn([g({ startDate: '2026-11-28' })], FRI)).toEqual([])
    expect(occurrencesOn([g({ endDate: '2026-11-26' })], FRI)).toEqual([])
    expect(occurrencesOn([g({ endDate: FRI })], FRI)).toHaveLength(1)
    expect(occurrencesOn([g({ archived: true })], FRI)).toEqual([])
  })

  it('skips paused months', () => {
    expect(occurrencesOn([g({ pausedMonths: ['2026-11'] })], FRI)).toEqual([])
  })

  it('keeps a cancelled lesson visible, marked with who cancelled it', () => {
    const group = g({ exceptions: { [FRI]: { type: 'cancel', by: 'teacher' } } })
    expect(occurrencesOn([group], FRI)).toEqual([
      { groupId: 'g1', date: FRI, time: '17:00', durationMin: 30, kind: 'regular', cancelledBy: 'teacher' },
    ])
  })

  it('moves a lesson to another day and time', () => {
    const group = g({ exceptions: { [FRI]: { type: 'move', toDate: SAT, toTime: '20:00' } } })
    expect(occurrencesOn([group], FRI)).toEqual([])
    expect(occurrencesOn([group], SAT)).toEqual([
      { groupId: 'g1', date: SAT, time: '20:00', durationMin: 30, kind: 'regular', movedFrom: FRI },
    ])
  })

  it('adds an extra lesson such as a makeup', () => {
    const group = g({ exceptions: { [SAT]: { type: 'extra', time: '18:00', kind: 'makeup', makeupFor: '2026-11-20' } } })
    expect(occurrencesOn([group], SAT)).toEqual([
      { groupId: 'g1', date: SAT, time: '18:00', durationMin: 30, kind: 'makeup', makeupFor: '2026-11-20' },
    ])
  })

  it('sorts lessons from several groups by time', () => {
    const a = g({ id: 'a', slots: [{ weekday: 5, time: '19:00' }] })
    const b = g({ id: 'b', slots: [{ weekday: 5, time: '08:15' }] })
    expect(occurrencesOn([a, b], FRI).map((o) => o.groupId)).toEqual(['b', 'a'])
  })
})

describe('studentLocalTime', () => {
  it('converts the teacher time to the student country time', () => {
    expect(studentLocalTime(FRI, '17:00', 'Africa/Cairo', 'Asia/Riyadh')).toBe('18:00')
    expect(studentLocalTime(FRI, '17:00', 'Africa/Cairo', 'Europe/London')).toBe('15:00')
  })

  it('handles crossing midnight', () => {
    expect(studentLocalTime(FRI, '23:30', 'Africa/Cairo', 'Asia/Dubai')).toBe('01:30')
  })
})

describe('groupTitle', () => {
  const students = [
    { id: 's1', name: 'يوسف' },
    { id: 's2', name: 'عمر' },
    { id: 's3', name: 'آدم' },
  ]
  it('uses the name when set', () => {
    expect(groupTitle({ name: 'حلقة الفجر', studentIds: ['s1'] }, students)).toBe('حلقة الفجر')
  })
  it('falls back to student names', () => {
    expect(groupTitle({ studentIds: ['s1'] }, students)).toBe('يوسف')
    expect(groupTitle({ studentIds: ['s1', 's2'] }, students)).toBe('يوسف وعمر')
    expect(groupTitle({ studentIds: ['s1', 's2', 's3'] }, students)).toBe('يوسف وعمر و١ آخر')
  })
})

describe('scheduleText', () => {
  it('lists days in week order with 12-hour Arabic times', () => {
    expect(
      scheduleText([
        { weekday: 2, time: '19:00' },
        { weekday: 6, time: '09:30' },
      ]),
    ).toBe('السبت ٩:٣٠ ص، الثلاثاء ٧:٠٠ م')
  })
})

describe('validateGroup', () => {
  const ok: GroupInput = {
    studentIds: ['s1'],
    startDate: '2026-11-27',
    slots: [{ weekday: 5, time: '17:00' }],
    durationMin: 30,
    pausedMonths: [],
    exceptions: {},
    archived: false,
  }
  it('accepts a valid group', () => {
    expect(validateGroup(ok)).toEqual({})
  })
  it('requires at least one student and one day', () => {
    expect(validateGroup({ ...ok, studentIds: [] }).studentIds).toBeDefined()
    expect(validateGroup({ ...ok, slots: [] }).slots).toBeDefined()
  })
  it('requires a time for every chosen day', () => {
    expect(validateGroup({ ...ok, slots: [{ weekday: 5, time: '' }] }).slots).toBeDefined()
  })
})

describe('calendar helpers', () => {
  it('starts weeks on Saturday', () => {
    expect(weekStart('2026-11-27')).toBe('2026-11-21') // Friday → previous Saturday
    expect(weekStart('2026-11-28')).toBe('2026-11-28') // Saturday itself
    expect(weekDates('2026-11-27')).toEqual([
      '2026-11-21',
      '2026-11-22',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ])
  })

  it('builds whole weeks covering a month', () => {
    const g = monthGrid('2026-11')
    expect(g[0]).toBe('2026-10-31') // Saturday before Sun 1 Nov
    expect(g.at(-1)).toBe('2026-12-04') // Friday after Mon 30 Nov
    expect(g.length % 7).toBe(0)
  })
})
