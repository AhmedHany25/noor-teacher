import { unrecordedLessons } from '../domain/attendance'
import { groupBatchStart } from '../domain/dues'
import { todayISO, type Occurrence } from '../domain/schedule'
import { hhmm, useClock } from '../lib/clock'
import { useAcademies, useGroups, usePayments, useSessions, useStudents } from './data'

export const MISSED_DAYS = 60

/** Past lessons with no attendance, within the current unpaid batch of each payer. */
export function useMissedLessons(): { missed: Occurrence[]; loading: boolean } {
  const { now } = useClock()
  const g = useGroups()
  const s = useStudents()
  const a = useAcademies()
  const x = useSessions()
  const p = usePayments()
  const loading = g.loading || s.loading || a.loading || x.loading || p.loading
  if (loading) return { missed: [], loading }
  const since = (groupId: string) => {
    const group = g.items.find((y) => y.id === groupId)
    return group ? groupBatchStart(group, s.items, a.items, p.items) : undefined
  }
  return { missed: unrecordedLessons(g.items, x.items, todayISO(now), hhmm(now), MISSED_DAYS, since), loading }
}
