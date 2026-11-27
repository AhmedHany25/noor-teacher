import { describe, expect, it } from 'vitest'
import type { Academy } from './academy'
import type { Group } from './schedule'
import { studentReminderMessage, studentRemindersFor } from './studentReminders'
import type { Student } from './student'

const furqan: Academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false, remindHours: 4 }
const huda: Academy = { id: 'a2', name: 'الهدى', currency: 'دولار', payMode: 'hour', rate: 8, archived: false }
const students: Student[] = [
  { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 },
  { id: 's2', name: 'عمر', academyId: 'a2', status: 'active', createdAt: 1 },
  { id: 's3', name: 'سارة', academyId: null, status: 'active', createdAt: 1 },
]
const g = (id: string, sid: string, weekday: 5 | 6, time: string): Group => ({
  id,
  studentIds: [sid],
  startDate: '2026-11-01',
  slots: [{ weekday, time }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
})
// Friday 27 Nov; Saturday 28 is tomorrow.
const FRI = '2026-11-27'

describe('studentRemindersFor', () => {
  it('reminds students of academies that require it, the set hours before', () => {
    const r = studentRemindersFor({ today: FRI, groups: [g('g1', 's1', 5, '17:00'), g('g2', 's2', 5, '18:00')], students, academies: [furqan, huda], privateHours: 0 })
    expect(r).toEqual([{ key: `g1:${FRI}:17:00:s1`, groupId: 'g1', studentId: 's1', date: FRI, time: '17:00', hours: 4, dueTime: '13:00' }])
  })

  it('uses the private-students setting for students without an academy', () => {
    const r = studentRemindersFor({ today: FRI, groups: [g('g3', 's3', 5, '20:00')], students, academies: [], privateHours: 2 })
    expect(r[0]).toMatchObject({ studentId: 's3', dueTime: '18:00' })
  })

  it("includes tomorrow's early lesson when its reminder time is today", () => {
    const r = studentRemindersFor({ today: FRI, groups: [g('g1', 's1', 6, '02:00')], students, academies: [furqan], privateHours: 0 })
    expect(r).toEqual([expect.objectContaining({ date: '2026-11-28', dueTime: '22:00' })])
  })

  it('skips a reminder that belongs to another day', () => {
    const early = studentRemindersFor({ today: FRI, groups: [g('g1', 's1', 5, '02:00')], students, academies: [furqan], privateHours: 0 })
    expect(early).toEqual([]) // due yesterday at 22:00
  })
})

describe('studentReminderMessage', () => {
  it("writes the family a reminder with the student's local time", () => {
    expect(studentReminderMessage({ name: 'يوسف', date: FRI, time: '17:00', today: FRI, teacherTz: 'Africa/Cairo', studentTz: 'Asia/Riyadh' })).toBe(
      ['السلام عليكم ورحمة الله وبركاته', 'تذكير بحصة يوسف اليوم الساعة ٦:٠٠ م بتوقيت السعودية بإذن الله.', 'في انتظاركم 🌿'].join('\n'),
    )
    expect(studentReminderMessage({ name: 'عمر', date: '2026-11-28', time: '09:30', today: FRI, teacherTz: 'Africa/Cairo' })).toContain(
      'تذكير بحصة عمر بكرة الساعة ٩:٣٠ ص بإذن الله.',
    )
  })
})
