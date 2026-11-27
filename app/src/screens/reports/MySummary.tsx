import { useState } from 'react'
import { MonthNav } from '../../components/MonthNav'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, usePayments, useSessions, useStudents } from '../../data/data'
import { DEFAULT_BASE_CURRENCY } from '../../domain/dues'
import { money } from '../../domain/statement'
import { teacherMonth } from '../../domain/summary'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'

/** Route: /reports/summary — the teacher's own month in numbers. */
export function MySummary() {
  const { today } = useClock()
  const [month, setMonth] = useState(today.slice(0, 7))
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const { items: groups } = useGroups()
  const { items: sessions, loading: l2 } = useSessions()
  const { items: payments } = usePayments()
  if (loading || l2) return null

  const m = teacherMonth({ students, academies, groups, sessions, payments, baseCurrency: DEFAULT_BASE_CURRENCY, month })
  const hours = Math.round((m.minutes / 60) * 10) / 10

  return (
    <>
      <PageHeader title="ملخصك الشهري" />
      <MonthNav month={month} max={today.slice(0, 7)} onChange={setMonth} />

      <section className="stats stats-4" aria-label="أرقام الشهر">
        <div className="stat stat-good">
          <b>{toArabicDigits(m.lessons)}</b>
          <span>حصة اتعملت</span>
        </div>
        <div className="stat">
          <b>{toArabicDigits(hours)}</b>
          <span>ساعة</span>
        </div>
        <div className="stat">
          <b>{toArabicDigits(m.students)}</b>
          <span>طالب حضر</span>
        </div>
        <div className="stat">
          <b>{toArabicDigits(m.payers.length)}</b>
          <span>جهة دفع</span>
        </div>
      </section>

      <section className="lesson-section card" aria-label="الفلوس">
        <h2 className="lesson-section-title">الفلوس</h2>
        <div className="money-rows">
          <div>
            <span className="field-hint">المستحق عن الشهر</span>
            {m.earned.length ? m.earned.map((x) => <b key={x.currency}>{money(x.amount, x.currency)}</b>) : <b>—</b>}
          </div>
          <div>
            <span className="field-hint">اللي استلمته في الشهر</span>
            {m.received.length ? m.received.map((x) => <b key={x.currency}>{money(x.amount, x.currency)}</b>) : <b>—</b>}
          </div>
        </div>
      </section>

      {m.payers.length > 0 && (
        <section className="lesson-section card" aria-label="حسب الجهة">
          <h2 className="lesson-section-title">حسب الجهة</h2>
          <ul className="plain-list summary-list">
            {m.payers.map((p) => (
              <li key={p.key}>
                <span>
                  {p.name} <span className="field-hint">({p.kind === 'academy' ? 'أكاديمية' : 'خصوصي'})</span>
                </span>
                <b>{money(p.total, p.currency)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
