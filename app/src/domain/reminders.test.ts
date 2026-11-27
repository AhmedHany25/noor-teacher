import { describe, expect, it } from 'vitest'
import type { Session } from './attendance'
import { DEFAULT_NOTIFY, dueReminders, type NotifySettings } from './reminders'
import type { Group } from './schedule'
import type { Student } from './student'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 }

const group = (id: string, sid: string, time: string): Group => ({
  id,
  studentIds: [sid],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time }], // Fridays
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
})

const groups = [group('g1', 's1', '09:00'), group('g2', 's2', '17:00')]
const students = [yusuf, omar]
const FRI = '2026-11-27'

const run = (nowTime: string, opts: { settings?: NotifySettings; sessions?: Session[]; sent?: string[] } = {}) =>
  dueReminders({
    today: FRI,
    nowTime,
    groups,
    students,
    sessions: opts.sessions ?? [],
    settings: opts.settings ?? DEFAULT_NOTIFY,
    sent: new Set(opts.sent ?? []),
  })

describe('reminder before a lesson', () => {
  it('fires within the chosen minutes before the start', () => {
    expect(run('16:50').map((r) => r.key)).toContain(`before:g2:${FRI}:17:00`)
    const r = run('16:50').find((x) => x.key.startsWith('before:g2'))!
    expect(r.title).toBe('حصة عمر بعد ١٠ دقائق')
    expect(r.body).toBe('الساعة ٥:٠٠ م، ٣٠ دقيقة')
    expect(r.url).toBe(`/lessons/g2/${FRI}`)
  })

  it('does not fire too early, after the start, or twice', () => {
    expect(run('16:30').some((r) => r.key.startsWith('before:g2'))).toBe(false)
    expect(run('17:01').some((r) => r.key.startsWith('before:g2'))).toBe(false)
    expect(run('16:50', { sent: [`before:g2:${FRI}:17:00`] }).some((r) => r.key.startsWith('before:g2'))).toBe(false)
  })

  it('skips cancelled lessons and respects the setting', () => {
    const cancelled = [{ ...groups[1], exceptions: { [FRI]: { type: 'cancel' as const, by: 'student' as const } } }]
    expect(dueReminders({ today: FRI, nowTime: '16:50', groups: cancelled, students, sessions: [], settings: DEFAULT_NOTIFY, sent: new Set() })).toEqual([])
    expect(run('16:50', { settings: { ...DEFAULT_NOTIFY, beforeOn: false } }).some((r) => r.key.startsWith('before:'))).toBe(false)
  })
})

describe('end-of-day reminder', () => {
  it('lists lessons that started today but are not recorded', () => {
    const r = run('21:05').find((x) => x.key === `eod:${FRI}`)!
    expect(r.title).toBe('فاضل حصتين النهارده متسجلتش')
    expect(r.url).toBe('/')
  })

  it('stays quiet when everything is recorded or before its time', () => {
    const recorded: Session[] = ['g1', 'g2'].map((g) => ({
      id: `${g}_${FRI}`,
      groupId: g,
      date: FRI,
      time: '09:00',
      kind: 'regular',
      attendance: {},
      updatedAt: 1,
    }))
    expect(run('21:05', { sessions: recorded }).some((r) => r.key.startsWith('eod:'))).toBe(false)
    expect(run('20:00').some((r) => r.key.startsWith('eod:'))).toBe(false)
  })
})

describe('morning summary', () => {
  it('is off by default and summarises the day when switched on', () => {
    expect(run('08:05').some((r) => r.key.startsWith('morning:'))).toBe(false)
    const r = run('08:05', { settings: { ...DEFAULT_NOTIFY, morningOn: true } }).find((x) => x.key === `morning:${FRI}`)!
    expect(r.title).toBe('عندك حصتين النهارده')
    expect(r.body).toBe('يوسف ٩:٠٠ ص، عمر ٥:٠٠ م')
  })
})
