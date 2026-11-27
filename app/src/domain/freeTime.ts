import { WEEKDAY_NAMES, WEEK_ORDER, time12, type Group, type Weekday } from './schedule'

export type Interval = { from: number; to: number } // minutes since midnight
export type DayPlan = { weekday: Weekday; busy: Interval[]; free: Interval[]; lessons: number; minutes: number }

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function merge(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.from - b.from)
  const out: Interval[] = []
  for (const x of sorted) {
    const last = out.at(-1)
    if (last && x.from <= last.to) last.to = Math.max(last.to, x.to)
    else out.push({ ...x })
  }
  return out
}

/**
 * The weekly picture: for each day (Saturday first), the busy intervals from the groups'
 * regular slots, and the free gaps of at least `minGap` minutes within working hours.
 * Groups that ended before `today` are left out.
 */
export function weekPlan(groups: Group[], today: string, work: { from: string; to: string }, minGap = 30): DayPlan[] {
  const active = groups.filter((g) => !g.archived && (!g.endDate || g.endDate >= today))
  const start = minutesOf(work.from)
  const end = work.to === '00:00' ? 1440 : minutesOf(work.to)
  return WEEK_ORDER.map((weekday) => {
    const raw: Interval[] = []
    for (const g of active) {
      for (const s of g.slots) {
        if (s.weekday !== weekday) continue
        const from = minutesOf(s.time)
        raw.push({ from, to: Math.min(1440, from + g.durationMin) })
      }
    }
    const busy = merge(raw)
    const free: Interval[] = []
    let cursor = start
    for (const b of busy) {
      if (b.to <= start || b.from >= end) continue
      if (b.from - cursor >= minGap) free.push({ from: cursor, to: Math.min(b.from, end) })
      cursor = Math.max(cursor, b.to)
    }
    if (end - cursor >= minGap) free.push({ from: cursor, to: end })
    return { weekday, busy, free, lessons: raw.length, minutes: raw.reduce((n, x) => n + (x.to - x.from), 0) }
  })
}

/** «٢:٠٠ م – ٥:٠٠ م». */
export function intervalText(i: Interval): string {
  return `${time12(hhmm(i.from))} – ${time12(hhmm(i.to === 1440 ? 0 : i.to))}`
}

/** A message for an academy: the free times of each day. */
export function freeTimeText(plan: DayPlan[]): string {
  const lines = plan.map((d) => `${WEEKDAY_NAMES[d.weekday]}: ${d.free.length ? d.free.map(intervalText).join('، ') : 'مشغول'}`)
  return ['مواعيدي الفاضية (بتوقيت مصر):', ...lines].join('\n')
}
