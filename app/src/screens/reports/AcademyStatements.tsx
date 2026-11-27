import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { MonthNav } from '../../components/MonthNav'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, useSessions, useStudents } from '../../data/data'
import { DEFAULT_BASE_CURRENCY, monthDues, type PayerDues } from '../../domain/dues'
import { monthLabel } from '../../domain/schedule'
import { money, statementCsv, statementText } from '../../domain/statement'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Route: /reports/academies — each academy's monthly statement. */
export function AcademyStatements() {
  const { today } = useClock()
  const [month, setMonth] = useState(today.slice(0, 7))
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const { items: groups } = useGroups()
  const { items: sessions, loading: l2 } = useSessions()
  if (loading || l2) return null

  const statements = monthDues({ students, academies, groups, sessions, baseCurrency: DEFAULT_BASE_CURRENCY, month }).filter((p) => p.kind === 'academy')

  return (
    <>
      <PageHeader title="كشوف الأكاديميات" />
      <MonthNav month={month} max={today.slice(0, 7)} onChange={setMonth} />
      {statements.length === 0 ? (
        <section className="empty card">
          <p>مفيش حصص محسوبة لأكاديميات في الشهر ده.</p>
        </section>
      ) : (
        statements.map((p) => <Statement key={p.key} p={p} month={month} />)
      )}
    </>
  )
}

function Statement({ p, month }: { p: PayerDues; month: string }) {
  const lessons = p.lines.reduce((n, l) => n + l.lessons, 0)
  return (
    <section className="payer" aria-label={`كشف ${p.name}`}>
      <header className="payer-head">
        <Avatar name={p.name} />
        <div className="payer-id">
          <h3 className="payer-name">{p.name}</h3>
          <span className="payer-kind">
            {toArabicDigits(p.lines.length)} طالب، {toArabicDigits(lessons)} حصة
          </span>
        </div>
        <strong className="payer-total">{money(p.total, p.currency)}</strong>
      </header>
      <ul className="payer-lines">
        {p.lines.map((l) => (
          <li key={l.studentId}>
            <Avatar name={l.name} size="sm" />
            <span className="pl-body">
              <span className="pl-name">{l.name}</span>
              <span className="pl-detail">
                <span>{l.mode === 'hour' ? `${toArabicDigits(Math.round((l.minutes / 60) * 100) / 100)} ساعة` : l.mode === 'month' ? 'شهري' : `${toArabicDigits(l.lessons)} حصة`}</span>
              </span>
            </span>
            <span className="pl-amount">{money(l.amount, p.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="payer-actions">
        <a className="btn btn-primary btn-wa-send" href={`https://wa.me/?text=${encodeURIComponent(statementText(p, monthLabel(month)))}`} target="_blank" rel="noreferrer">
          إرسال الكشف واتساب
        </a>
        <button type="button" className="btn btn-quiet" onClick={() => download(`كشف ${p.name} ${month}.csv`, statementCsv(p, month))}>
          Excel
        </button>
      </div>
    </section>
  )
}
