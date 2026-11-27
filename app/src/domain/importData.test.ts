import { describe, expect, it } from 'vitest'
import { exportBackup, parseBackup } from './importData'

/** A small backup in the old site's format (noor.teacher.v1). */
const oldDb = {
  v: 1,
  settings: { name: 'أحمد', currency: 'ريال', cycTarget: 8 },
  academies: [
    { id: 'A1', name: 'الفرقان', phone: '0100', paid: { '2026-10': 1 } },
    { id: 'A2', name: 'فارغة' },
  ],
  students: [
    { id: 'S1', name: 'يوسف', phone: '01012345678', academy: 'A1', mode: 'session', rate: 40, level: 'جزء عم', age: 9, tz: 'Asia/Riyadh', photo: 'data:image/png;base64,xx' },
    { id: 'S2', name: 'عمر', academy: 'A1', mode: 'session', rate: 40, status: 'paused' },
    { id: 'S3', name: 'آدم', academy: 'A1', mode: 'session', rate: 55 },
    { id: 'S4', name: 'سارة', academy: '', mode: 'month', rate: 600, note: 'تحب التلاوة' },
  ],
  groups: [
    {
      id: 'G1',
      students: ['S1'],
      date: '2026-10-02',
      time: '17:00',
      dur: 30,
      repeat: 'weekly',
      days: ['5', '1'],
      times: { 1: '19:00' },
      until: '2026-12-31',
      off: { '2026-08': 1 },
      ex: {
        '2026-10-09': { c: 1, paid: false },
        '2026-10-16': { c: 1, paid: true },
        '2026-10-23': { mv: '2026-10-24', t: '20:00' },
      },
    },
    { id: 'G2', students: ['S4'], date: '2026-10-05', time: '10:00', dur: 60, repeat: 'once', kind: 'trial', name: 'تجريبية سارة' },
  ],
  attendance: {
    'G1|2026-10-02': { st: { S1: 'p' } },
    'G1|2026-10-30': { st: { S1: 'a' }, pay: { S1: 1 }, dur: 45 },
    'G1|2026-11-06': { st: { S1: 'e' } },
    'G2|2026-10-05': { st: { S4: 'p' } },
  },
  payments: [],
  plans: [{ id: 'P1', title: 'حفظ جزء عم' }],
  progress: { S1: { last: 'النبأ' } },
  marks: { S1: { '78:1:1': 1 } },
  games: {},
}

describe('parseBackup: old site format', () => {
  const r = parseBackup(JSON.stringify({ app: 'noor-teacher', v: 1, db: oldDb }), 'جنيه')

  it('recognises the old format, wrapped or bare', () => {
    expect(r.ok && r.source).toBe('old')
    const bare = parseBackup(JSON.stringify(oldDb), 'جنيه')
    expect(bare.ok && bare.data.students).toHaveLength(4)
  })

  if (!r.ok) throw new Error('parse failed')
  const d = r.data

  it('maps students, keeping ids and dropping photos', () => {
    expect(d.students.find((s) => s.id === 'S1')).toMatchObject({
      name: 'يوسف',
      guardianPhone: '01012345678',
      academyId: 'A1',
      level: 'جزء عم',
      age: 9,
      timeZone: 'Asia/Riyadh',
      status: 'active',
    })
    expect(d.students.find((s) => s.id === 'S1')).not.toHaveProperty('photo')
    expect(d.students.find((s) => s.id === 'S2')?.status).toBe('paused')
    expect(d.students.find((s) => s.id === 'S4')).toMatchObject({ academyId: null, payMode: 'month', rate: 600, notes: 'تحب التلاوة' })
  })

  it('gives each academy its most common student rate; others keep a special rate', () => {
    expect(d.academies.find((a) => a.id === 'A1')).toMatchObject({ name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40 })
    expect(d.students.find((s) => s.id === 'S1')?.rate).toBeUndefined()
    expect(d.students.find((s) => s.id === 'S3')).toMatchObject({ rate: 55 })
    expect(d.academies.find((a) => a.id === 'A2')).toMatchObject({ payMode: 'session', rate: 0 })
  })

  it('maps weekly groups with per-day times, end date, paused months and exceptions', () => {
    expect(d.groups.find((g) => g.id === 'G1')).toEqual({
      id: 'G1',
      studentIds: ['S1'],
      startDate: '2026-10-02',
      endDate: '2026-12-31',
      slots: [
        { weekday: 5, time: '17:00' },
        { weekday: 1, time: '19:00' },
      ],
      durationMin: 30,
      pausedMonths: ['2026-08'],
      exceptions: {
        '2026-10-09': { type: 'cancel', by: 'student' },
        '2026-10-23': { type: 'move', toDate: '2026-10-24', toTime: '20:00' },
      },
      archived: false,
    })
  })

  it('turns a one-off lesson into a single-day group', () => {
    expect(d.groups.find((g) => g.id === 'G2')).toMatchObject({
      name: 'تجريبية سارة',
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      slots: [{ weekday: 1, time: '10:00' }],
    })
  })

  it('maps attendance: present always counts, absences only when marked paid', () => {
    expect(d.sessions.find((s) => s.id === 'G1_2026-10-02')?.attendance).toEqual({ S1: { status: 'p', billable: true } })
    expect(d.sessions.find((s) => s.id === 'G1_2026-10-30')).toMatchObject({
      attendance: { S1: { status: 'a', billable: true } },
      actualDurationMin: 45,
    })
    expect(d.sessions.find((s) => s.id === 'G1_2026-11-06')?.attendance.S1).toEqual({ status: 'e', billable: false })
    expect(d.sessions.find((s) => s.id === 'G2_2026-10-05')?.kind).toBe('trial')
  })

  it('keeps the money of a paid cancellation as a billable excused lesson', () => {
    expect(d.sessions.find((s) => s.id === 'G1_2026-10-16')).toMatchObject({
      date: '2026-10-16',
      time: '17:00',
      kind: 'regular',
      attendance: { S1: { status: 'e', billable: true } },
    })
  })

  it("records a month marked paid as a received payment equal to that month's dues", () => {
    // October for A1: 02 present + 16 paid cancellation + 30 paid absence = 3 lessons × 40.
    expect(d.payments).toEqual([
      { id: 'old-A1-2026-10', payerKey: 'A1', amount: 120, currency: 'ريال', date: '2026-10-31', resetsCycle: true, note: 'من الموقع القديم' },
    ])
  })

  it('keeps plans, progress and marks as legacy data', () => {
    expect(Object.keys(d.legacy).sort()).toEqual(['marks', 'plans', 'progress'])
  })

  it('summarises what will be imported', () => {
    expect(r.summary).toEqual({ students: 4, academies: 2, groups: 2, sessions: 5, payments: 1 })
  })
})

describe('parseBackup: errors and new format', () => {
  it('explains invalid files', () => {
    expect(parseBackup('not json', 'جنيه')).toEqual({ ok: false, error: 'الملف مش JSON صالح.' })
    expect(parseBackup('{"x":1}', 'جنيه')).toEqual({ ok: false, error: 'الملف مش نسخة احتياطية من نور القرآن.' })
  })

  it('round-trips a backup exported by this app', () => {
    const data = {
      students: [{ id: 's1', name: 'يوسف', academyId: null, status: 'active' as const, createdAt: 5 }],
      academies: [],
      groups: [],
      sessions: [],
      payments: [],
      legacy: {},
    }
    const r = parseBackup(exportBackup(data, 1000), 'جنيه')
    expect(r.ok && r.source).toBe('new')
    expect(r.ok && r.data).toEqual(data)
  })
})
