import { describe, expect, it } from 'vitest'
import { freeTimeText, intervalText, weekPlan } from './freeTime'
import type { Group } from './schedule'

const g = (id: string, slots: Group['slots'], durationMin = 60, over: Partial<Group> = {}): Group => ({
  id,
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots,
  durationMin,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

const groups = [
  g('a', [{ weekday: 6, time: '15:00' }, { weekday: 2, time: '18:00' }]), // Sat 3–4 pm, Tue 6–7 pm
  g('b', [{ weekday: 6, time: '15:30' }], 60), // overlaps on Saturday: 3:30–4:30
  g('c', [{ weekday: 6, time: '20:00' }], 30),
  g('old', [{ weekday: 0, time: '15:00' }], 60, { endDate: '2026-10-01' }),
]
const work = { from: '14:00', to: '23:00' }

describe('weekPlan', () => {
  const plan = weekPlan(groups, '2026-11-27', work)
  const sat = plan[0]

  it('starts the week on Saturday and merges overlapping lessons', () => {
    expect(sat.weekday).toBe(6)
    expect(sat.busy).toEqual([
      { from: 15 * 60, to: 16 * 60 + 30 },
      { from: 20 * 60, to: 20 * 60 + 30 },
    ])
    expect(sat.lessons).toBe(3)
    expect(sat.minutes).toBe(150)
  })

  it('finds the free gaps inside working hours', () => {
    expect(sat.free.map(intervalText)).toEqual(['٢:٠٠ م – ٣:٠٠ م', '٤:٣٠ م – ٨:٠٠ م', '٨:٣٠ م – ١١:٠٠ م'])
  })

  it('leaves out ended groups and treats an empty day as all free', () => {
    const sun = plan[1]
    expect(sun.weekday).toBe(0)
    expect(sun.busy).toEqual([])
    expect(sun.free.map(intervalText)).toEqual(['٢:٠٠ م – ١١:٠٠ م'])
  })

  it('ignores gaps shorter than half an hour', () => {
    const tight = weekPlan([g('x', [{ weekday: 6, time: '14:20' }], 60)], '2026-11-27', work)
    expect(tight[0].free.map(intervalText)).toEqual(['٣:٢٠ م – ١١:٠٠ م'])
  })
})

describe('freeTimeText', () => {
  it('writes a message for the academy, one line per day', () => {
    const text = freeTimeText(weekPlan(groups, '2026-11-27', work))
    expect(text.split('\n')[0]).toBe('مواعيدي الفاضية (بتوقيت مصر):')
    expect(text).toContain('السبت: ٢:٠٠ م – ٣:٠٠ م، ٤:٣٠ م – ٨:٠٠ م، ٨:٣٠ م – ١١:٠٠ م')
    expect(text.split('\n')).toHaveLength(8)
  })
})
