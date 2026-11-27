import { LessonRow } from '../../components/LessonRow'
import { useGroups, useSessions, useStudents } from '../../data/data'
import { unrecordedLessons } from '../../domain/attendance'
import { groupTitle, todayISO } from '../../domain/schedule'
import { hhmm, useClock } from '../../lib/clock'
import { longDate } from '../../lib/format'

const DAYS = 60

/** Route: /review — past lessons (last 60 days) with no attendance yet. */
export function ReviewScreen() {
  const { now } = useClock()
  const { items: groups, loading } = useGroups()
  const { items: students } = useStudents()
  const { items: sessions, loading: loadingSessions } = useSessions()
  if (loading || loadingSessions) return null

  const missed = unrecordedLessons(groups, sessions, todayISO(now), hhmm(now), DAYS)

  return (
    <>
      <h1 className="screen-title">حصص لم تُسجَّل</h1>
      {missed.length === 0 ? (
        <section className="empty">
          <p>كل الحصص اللي فاتت متسجلة.</p>
        </section>
      ) : (
        <>
          <p className="section-note screen-lead">آخر ٦٠ يومًا. سجّل كل حصة بضغطة، أو افتحها لو محتاج تلغيها أو تنقلها.</p>
          <section aria-label="حصص لم تُسجَّل">
            {[...new Set(missed.map((o) => o.date))].map((date) => (
              <div key={date} className="review-day">
                <h2 className="day-heading">{longDate(date)}</h2>
                <ol className="lessons">
                  {missed
                    .filter((o) => o.date === date)
                    .map((o) => {
                      const group = groups.find((g) => g.id === o.groupId)!
                      return (
                        <LessonRow key={`${o.groupId}-${o.time}`} o={o} group={group} title={groupTitle(group, students)} />
                      )
                    })}
                </ol>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  )
}
