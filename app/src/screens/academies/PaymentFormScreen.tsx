import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Field } from '../../components/Field'
import { useAcademies, useData, useGroups, usePayments, useSessions, useStudents } from '../../data/data'
import { DEFAULT_BASE_CURRENCY, balances, payerKey } from '../../domain/dues'
import { todayISO } from '../../domain/schedule'
import { useClock } from '../../lib/clock'
import { parseNumber } from '../../lib/format'

/** Route: /payments/new?payer=<key> */
export function PaymentFormScreen() {
  const { items: academies, loading } = useAcademies()
  const { items: students, loading: l2 } = useStudents()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const { items: payments, loading: l3 } = usePayments()
  if (loading || l2 || l3) return null

  const payers = [
    ...academies.filter((a) => !a.archived).map((a) => ({ key: a.id, name: a.name, currency: a.currency, academy: true })),
    ...students
      .filter((s) => !s.academyId && s.status !== 'left')
      .map((s) => ({ key: payerKey(s), name: `${s.name} (خصوصي)`, currency: DEFAULT_BASE_CURRENCY, academy: false })),
  ]
  const bal = balances({ students, academies, groups, sessions, baseCurrency: DEFAULT_BASE_CURRENCY }, payments)
  return <PaymentForm payers={payers} outstanding={(k) => bal.get(k)?.outstanding ?? 0} />
}

type Payer = { key: string; name: string; currency: string; academy: boolean }

function PaymentForm({ payers, outstanding }: { payers: Payer[]; outstanding: (key: string) => number }) {
  const { repos, notify } = useData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { now } = useClock()

  const initial = payers.find((p) => p.key === params.get('payer')) ?? payers[0]
  const owed = (k?: string) => (k && outstanding(k) > 0 ? String(outstanding(k)) : '')

  const [key, setKey] = useState(initial?.key ?? '')
  const [amount, setAmount] = useState(owed(initial?.key))
  const [date, setDate] = useState(todayISO(now))
  const [resetsCycle, setResetsCycle] = useState(initial?.academy ?? false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const payer = payers.find((p) => p.key === key)

  function choose(k: string) {
    setKey(k)
    setAmount(owed(k))
    setResetsCycle(payers.find((p) => p.key === k)?.academy ?? false)
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const value = parseNumber(amount)
    if (!payer) return setError('اختر الجهة.')
    if (!value || value <= 0) return setError('اكتب المبلغ اللي استلمته.')
    repos.payments.create({
      payerKey: payer.key,
      amount: value,
      currency: payer.currency,
      date,
      resetsCycle: payer.academy && resetsCycle,
      note: note.trim() || undefined,
    })
    notify('تم تسجيل المبلغ')
    navigate('/academies')
  }

  if (payers.length === 0) {
    return (
      <section className="empty">
        <h2>مفيش جهات دفع لسه</h2>
        <p>
          أضف أكاديمية أو طالب خصوصي الأول. <Link to="/academies">ارجع للمستحقات</Link>
        </p>
      </section>
    )
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <h1 className="screen-title">تسجيل مبلغ مستلم</h1>

      <Field id="payer" label="من">
        <select id="payer" value={key} onChange={(e) => choose(e.target.value)}>
          {payers.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="form-row">
        <Field id="amount" label="المبلغ" error={error || undefined} hint={payer ? `العملة: ${payer.currency}` : undefined}>
          <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field id="date" label="التاريخ">
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {payer?.academy && (
        <label className="check">
          <input type="checkbox" checked={resetsCycle} onChange={(e) => setResetsCycle(e.target.checked)} />
          <span>ده راتب الدورة (عدّاد الحصص يبدأ من جديد)</span>
        </label>
      )}

      <Field id="note" label="ملاحظة">
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" />
      </Field>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          حفظ
        </button>
        <Link to="/academies" className="btn btn-quiet">
          إلغاء
        </Link>
      </div>
    </form>
  )
}
