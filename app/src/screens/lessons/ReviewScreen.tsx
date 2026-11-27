import { PageHeader } from '../../components/PageHeader'
import { LessonRow } from '../../components/LessonRow'
import { useAcademies, useData, useGroups, usePayments, useStudents } from '../../data/data'
import { useMissedLessons } from '../../data/useMissed'
import { batchStart, payerKey } from '../../domain/dues'
import { groupTitle } from '../../domain/schedule'
import { longDate } from '../../lib/format'

/** Route: /review — lessons of the current unpaid batch (last 60 days) with no attendance yet. */
export function ReviewScreen() {
  const { items: groups } = useGroups()
  const { items: students } = useStudents()
  const { missed, loading } = useMissedLessons()
  if (loading) return null

  return (
    <>
      <PageHeader title="حصص لم تُسجَّل" />
      <p className="section-note screen-lead">
        بتظهر هنا حصص الدفعة الحالية بس، يعني من بعد آخر مبلغ استلمته من كل جهة. اللي قبلها اتحاسب خلاص.
      </p>

      {missed.length === 0 ? (
        <section className="empty">
          <p>كل حصص الدفعة الحالية متسجلة.</p>
        </section>
      ) : (
        <section aria-label="حصص لم تُسجَّل">
          {[...new Set(missed.map((o) => o.date))].map((date) => (
            <div key={date} className="review-day">
              <h2 className="day-heading">{longDate(date)}</h2>
              <ol className="lessons">
                {missed
                  .filter((o) => o.date === date)
                  .map((o) => {
                    const group = groups.find((g) => g.id === o.groupId)!
                    return <LessonRow key={`${o.groupId}-${o.time}`} o={o} group={group} title={groupTitle(group, students)} />
                  })}
              </ol>
            </div>
          ))}
        </section>
      )}

      <BatchStarts />
    </>
  )
}

/** Where each payer's current batch starts, editable. */
function BatchStarts() {
  const { repos, notify } = useData()
  const { items: academies } = useAcademies()
  const { items: students } = useStudents()
  const { items: payments } = usePayments()

  type Payer = { key: string; name: string; manual?: string; studentId?: string }
  const payers: Payer[] = [
    ...academies.filter((a) => !a.archived).map((a) => ({ key: a.id, name: a.name, manual: a.trackFrom })),
    ...students
      .filter((s) => !s.academyId && s.status === 'active')
      .map((s) => ({ key: payerKey(s), name: s.name, manual: s.trackFrom, studentId: s.id })),
  ]
  if (payers.length === 0) return null

  function setStart(p: Payer, date: string | undefined) {
    if (p.studentId) repos.students.patch(p.studentId, { trackFrom: date })
    else repos.academies.patch(p.key, { trackFrom: date })
    notify(date ? 'تم تحديد بداية الدفعة' : 'رجعت البداية لآخر مبلغ مستلم')
  }

  return (
    <details className="more batch-starts">
      <summary>بداية الدفعة لكل جهة</summary>
      <div className="more-body">
        <p className="field-hint">تلقائيًا بتبدأ من اليوم اللي بعد آخر مبلغ استلمته. غيّرها لو محتاج.</p>
        <ul className="rows" aria-label="بداية الدفعة لكل جهة">
          {payers.map((p) => {
            const start = batchStart(p.key, academies, students, payments)
            return (
              <li key={p.key} className="row batch-row">
                <label className="batch-label" htmlFor={`start-${p.key}`}>
                  <span className="row-title">{p.name}</span>
                  <span className="row-meta">
                    {start ? `من ${longDate(start)}` : 'من البداية (مفيش مبالغ مستلمة)'}
                    {p.manual ? '، حددتها بنفسك' : ''}
                  </span>
                </label>
                <input
                  id={`start-${p.key}`}
                  type="date"
                  className="day-time"
                  aria-label={'بداية دفعة ' + p.name}
                  value={p.manual ?? start ?? ''}
                  onChange={(e) => setStart(p, e.target.value || undefined)}
                />
                {p.manual && (
                  <button type="button" className="link-btn" onClick={() => setStart(p, undefined)}>
                    تلقائي
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}
