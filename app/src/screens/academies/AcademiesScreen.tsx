import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { PageHeader } from '../../components/PageHeader'
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
import { addMonths, monthLabel } from '../../domain/schedule'
import { money, statementCsv, statementText } from '../../domain/statement'
import { whatsappNumber, type Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'

type Balance = { earned: number; received: number; outstanding: number }

/** Sum amounts per currency: [«١٢٠ ريال», «٦٠٠ جنيه»]. */
function perCurrency(items: { amount: number; currency: string }[]): string[] {
  const m = new Map<string, number>()
  for (const x of items) m.set(x.currency, (m.get(x.currency) ?? 0) + x.amount)
  return [...m].map(([c, a]) => money(a, c))
}

/** Route: /academies — what each payer owes this month, what's still owed overall, and the academies. */
export function AcademiesScreen() {
  const { today } = useClock()
  const { items: academies, loading } = useAcademies()
  const { items: students, loading: l2 } = useStudents()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const { items: payments } = usePayments()
  const thisMonth = today.slice(0, 7)
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
  const cards = [...dues, ...leftovers]

  const totals = new Map<string, number>()
  for (const d of dues) totals.set(d.currency, (totals.get(d.currency) ?? 0) + d.total)
  const owed = perCurrency(cards.map((p) => ({ amount: Math.max(0, bal.get(p.key)?.outstanding ?? 0), currency: p.currency })).filter((x) => x.amount > 0))
  const receivedThisMonth = perCurrency(payments.filter((p) => p.date.startsWith(month)))

  return (
    <>
      <PageHeader title="المستحقات" />

      {students.length === 0 && academies.length === 0 ? (
        <section className="empty card">
          <h2>أضف الأكاديميات اللي بتشتغل معاها</h2>
          <p>لكل أكاديمية عملتها وسعرها. الطلاب اللي مش تبع أكاديمية بيتحسبوا «خصوصي».</p>
        </section>
      ) : (
        <>
          <section className="dues-hero">
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
              <>
                <p className="hero-label">مستحقات الشهر</p>
                <ul className="totals" aria-label="إجمالي الشهر">
                  {[...totals].map(([cur, total]) => (
                    <li key={cur}>{money(total, cur)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="dues-hero-empty">مفيش حصص محسوبة في الشهر ده لسه. المستحقات بتتحسب من الحضور.</p>
            )}

            {(owed.length > 0 || receivedThisMonth.length > 0) && (
              <div className="dues-hero-row">
                {owed.length > 0 && (
                  <div>
                    <span>المتبقي ليك</span>
                    {owed.map((x) => (
                      <b key={x}>{x}</b>
                    ))}
                  </div>
                )}
                {receivedThisMonth.length > 0 && (
                  <div>
                    <span>استلمت الشهر ده</span>
                    {receivedThisMonth.map((x) => (
                      <b key={x}>{x}</b>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {cards.map((p) => (
            <PayerCard
              key={p.key}
              p={p}
              month={month}
              balance={bal.get(p.key) ?? { earned: 0, received: 0, outstanding: 0 }}
              students={students}
              cycle={(sid) => cycleCount(sid, p.key, sessions, payments)}
              payments={payments.filter((x) => x.payerKey === p.key && x.date.startsWith(month))}
            />
          ))}
        </>
      )}

      <details className="more manage" open={academies.length === 0}>
        <summary>إدارة الأكاديميات</summary>
        <div className="more-body">
          <Link to="/academies/new" className="btn btn-quiet manage-add">
            إضافة أكاديمية
          </Link>
          {academies.length > 0 && (
            <ul className="rows" aria-label="الأكاديميات">
              {sortAcademies(academies).map((a) => (
                <li key={a.id} className={a.archived ? 'row is-muted' : 'row'}>
                  <Avatar name={a.name} size="sm" />
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
        </div>
      </details>
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

/** Eight dots filling up as the cycle's lessons happen. */
function CycleDots({ count }: { count: number }) {
  const target = DEFAULT_CYCLE_TARGET
  return (
    <span className="cycle">
      <span className="cycle-dots" aria-hidden="true">
        {Array.from({ length: target }, (_, i) => (
          <span key={i} className={i < count ? 'cd is-on' : 'cd'} />
        ))}
      </span>
      <span className="cycle-text">
        الدورة: {toArabicDigits(count)} من {toArabicDigits(target)}
      </span>
    </span>
  )
}

function PayerCard({
  p,
  month,
  balance,
  students,
  cycle,
  payments,
}: {
  p: PayerDues
  month: string
  balance: Balance
  students: Student[]
  cycle: (studentId: string) => number
  payments: Payment[]
}) {
  const { repos, notify } = useData()
  const text = statementText(p, monthLabel(month))
  const guardian = p.kind === 'private' ? students.find((s) => `student:${s.id}` === p.key) : undefined
  const phone = guardian?.guardianPhone ? whatsappNumber(guardian.guardianPhone, guardian.timeZone, DEFAULT_TIME_ZONE) : null
  const waHref = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`
  // A private payer is one student: show their detail in the header instead of repeating the name.
  const soloLine = p.kind === 'private' && p.lines.length === 1 ? p.lines[0] : undefined
  const outstanding = Math.max(0, balance.outstanding)
  const paidShare = balance.earned > 0 ? Math.min(1, balance.received / balance.earned) : 0

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
        <Avatar name={p.name} />
        <div className="payer-id">
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
              <Avatar name={l.name} size="sm" />
              <span className="pl-body">
                <span className="pl-name">{l.name}</span>
                <span className="pl-detail">
                  <span>{lineDetail(l)}</span>
                  {p.kind === 'academy' && <CycleDots count={cycle(l.studentId)} />}
                </span>
              </span>
              <span className="pl-amount">{money(l.amount, p.currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="payer-note">لا حصص محسوبة هذا الشهر.</p>
      )}

      <div className="payer-balance-box">
        <div className="paid-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(paidShare * 100)}%` }} />
        </div>
        <p className={outstanding > 0 ? 'payer-balance is-owed' : 'payer-balance'}>
          المتبقي ليك: {money(outstanding, p.currency)}
        </p>
      </div>

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
            <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-quiet btn-wa" aria-label="إرسال الكشف واتساب">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"
                />
              </svg>
              الكشف
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
