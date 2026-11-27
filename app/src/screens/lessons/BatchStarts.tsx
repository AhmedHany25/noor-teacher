import { useAcademies, useData, usePayments, useStudents } from '../../data/data'
import { batchStart, payerKey } from '../../domain/dues'
import { longDate } from '../../lib/format'

/** Where each payer's current batch starts, editable. */
export function BatchStarts() {
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
