import { useState } from 'react'
import { Link } from 'react-router'
import { useAcademies, useData, useGroups, usePayments, useSessions, useStudents } from '../../data/data'
import { rateText, sortAcademies } from '../../domain/academy'
import { DEFAULT_TIME_ZONE } from '../../domain/countries'
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_CYCLE_TARGET,
  balances,
  cycleCount,
  monthDues,
  type PayerDues,
  type Payment,
} from '../../domain/dues'
import { addMonths, monthLabel, todayISO } from '../../domain/schedule'
import { money, statementCsv, statementText } from '../../domain/statement'
import { whatsappNumber, type Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'

/** Route: /academies — what each payer owes this month, what's still owed overall, and the academies. */
export function AcademiesScreen() {
  const { now } = useClock()
  const { items: academies, loading } = useAcademies()
  const { items: students, loading: l2 } = useStudents()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const { items: payments } = usePayments()
  const thisMonth = todayISO(now).slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  if (loading || l2) return null

  const input = { students, academies, groups, sessions, baseCurrency: DEFAULT_BASE_CURRENCY }
  const dues = monthDues({ ...input, month })
  const bal = balances(input, payments)

  // On the current month, also show payers who still owe from earlier months.
  const leftovers: PayerDues[] =
    month === thisMonth
      ? [...bal.entries()]
          .filter(([k, v]) => v.outstanding > 0 && !dues.some((d) => d.key === k))
          .map(([k]) => payerShell(k, academies, students))
          .filter((p): p is PayerDues => !!p)
      : []

  const totals = new Map<string, number>()
  for (const d of dues) totals.set(d.currency, (totals.get(d.currency) ?? 0) + d.total)

  return (
    <>
      <h1 className="screen-title">المستحقات</h1>

      {students.length === 0 && academies.length === 0 ? (
        <section className="empty">
          <h2>أضف الأكاديميات اللي بتشتغل معاها</h2>
          <p>لكل أكاديمية عملتها وسعرها. الطلاب اللي مش تبع أكاديمية بيتحسبوا «خصوصي».</p>
        </section>
      ) : (
        <>
          <div className="month-nav">
            <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => setMonth(addMonths(month, -1))}>
              ›
            </button>
            <h2 className="month-title">{monthLabel(month)}</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="الشهر التالي"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={month >= thisMonth}
            >
              ‹
            </button>
          </div>

          {dues.length > 0 ? (
            <ul className="totals" aria-label="إجمالي الشهر">
              {[...totals].map(([cur, total]) => (
                <li key={cur}>{money(total, cur)}</li>
              ))}
            </ul>
          ) : (
            <p className="list-empty">مفيش حصص محسوبة في الشهر ده لسه. المستحقات بتتحسب من الحضور.</p>
          )}

          {[...dues, ...leftovers].map((p) => (
            <PayerCard
              key={p.key}
              p={p}
              month={month}
              outstanding={bal.get(p.key)?.outstanding ?? 0}
              students={students}
              cycle={(sid) => cycleCount(sid, p.key, sessions, payments)}
              payments={payments.filter((x) => x.payerKey === p.key && x.date.startsWith(month))}
            />
          ))}
        </>
      )}

      <div className="screen-head section-head">
        <h2 className="section-title">الأكاديميات</h2>
        <Link to="/academies/new" className="btn btn-quiet">
          إضافة أكاديمية
        </Link>
      </div>
      {academies.length > 0 && (
        <ul className="rows" aria-label="الأكاديميات">
          {sortAcademies(academies).map((a) => (
            <li key={a.id} className={a.archived ? 'row is-muted' : 'row'}>
              <Link to={`/academies/${a.id}`} className="row-main">
                <span className="row-title">{a.name}</span>
                <span className="row-meta">
                  <span>{rateText(a)}</span>
                  <span>
                    {toArabicDigits(students.filter((s) => s.academyId === a.id && s.status === 'active').length)} طالب
                  </span>
                  {a.archived && <span>متوقفة</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** A payer with nothing due this month (only an old balance). */
function payerShell(key: string, academies: { id: string; name: string; currency: string }[], students: Student[]): PayerDues | undefined {
  const a = academies.find((x) => x.id === key)
  if (a) return { key, name: a.name, kind: 'academy', currency: a.currency, lines: [], total: 0 }
  const s = students.find((x) => `student:${x.id}` === key)
  if (s) return { key, name: s.name, kind: 'private', currency: DEFAULT_BASE_CURRENCY, lines: [], total: 0 }
  return undefined
}

function lineDetail(l: PayerDues['lines'][number]): string {
  if (l.mode === 'hour') return `${toArabicDigits(Math.round((l.minutes / 60) * 100) / 100)} ساعة`
  if (l.mode === 'month') return 'شهري'
  return `${toArabicDigits(l.lessons)} ${l.lessons === 1 ? 'حصة' : l.lessons <= 10 ? 'حصص' : 'حصة'}`
}

function PayerCard({
  p,
  month,
  outstanding,
  students,
  cycle,
  payments,
}: {
  p: PayerDues
  month: string
  outstanding: number
  students: Student[]
  cycle: (studentId: string) => number
  payments: Payment[]
}) {
  const { repos, notify } = useData()
  const text = statementText(p, monthLabel(month))
  // A private payer is one student: show their detail in the header instead of repeating the name.
  const soloLine = p.kind === 'private' && p.lines.length === 1 ? p.lines[0] : undefined
  const guardian = p.kind === 'private' ? students.find((s) => `student:${s.id}` === p.key) : undefined
  const phone = guardian?.guardianPhone ? whatsappNumber(guardian.guardianPhone, guardian.timeZone, DEFAULT_TIME_ZONE) : null
  const waHref = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`

  function downloadCsv() {
    const blob = new Blob([statementCsv(p, month)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `كشف ${p.name} ${month}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function removePayment(id: string) {
    if (!window.confirm('حذف المبلغ المسجل؟')) return
    repos.payments.remove(id)
    notify('تم حذف المبلغ')
  }

  return (
    <section className="payer" aria-label={p.name}>
      <header className="payer-head">
        <div>
          <h3 className="payer-name">{p.name}</h3>
          <span className="payer-kind">
            {p.kind === 'academy' ? 'أكاديمية' : soloLine ? `خصوصي، ${lineDetail(soloLine)}` : 'خصوصي'}
          </span>
        </div>
        <strong className="payer-total">{money(p.total, p.currency)}</strong>
      </header>

      {soloLine ? null : p.lines.length > 0 ? (
        <ul className="payer-lines">
          {p.lines.map((l) => (
            <li key={l.studentId}>
              <span className="pl-name">{l.name}</span>
              <span className="pl-detail">
                {lineDetail(l)}
                {p.kind === 'academy' && (
                  <span className="pl-cycle">
                    الدورة: {toArabicDigits(cycle(l.studentId))} من {toArabicDigits(DEFAULT_CYCLE_TARGET)}
                  </span>
                )}
              </span>
              <span className="pl-amount">{money(l.amount, p.currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="payer-note">لا حصص محسوبة هذا الشهر.</p>
      )}

      <p className={outstanding > 0 ? 'payer-balance is-owed' : 'payer-balance'}>المتبقي ليك: {money(Math.max(0, outstanding), p.currency)}</p>

      {payments.length > 0 && (
        <ul className="payer-payments" aria-label={`مبالغ مستلمة من ${p.name}`}>
          {payments.map((x) => (
            <li key={x.id}>
              <span>
                استلمت {money(x.amount, x.currency)} يوم {longDate(x.date)}
              </span>
              <button type="button" className="link-btn" onClick={() => removePayment(x.id)}>
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="payer-actions">
        <Link to={`/payments/new?payer=${encodeURIComponent(p.key)}`} className="btn btn-primary">
          تسجيل مبلغ مستلم
        </Link>
        {p.lines.length > 0 && (
          <>
            <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-quiet" aria-label="إرسال الكشف واتساب">
              إرسال الكشف
            </a>
            <button type="button" className="btn btn-quiet" onClick={downloadCsv} aria-label="تحميل Excel">
              Excel
            </button>
          </>
        )}
      </div>
    </section>
  )
}
