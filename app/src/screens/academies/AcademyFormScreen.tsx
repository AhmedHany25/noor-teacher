import { PageHeader } from '../../components/PageHeader'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Field } from '../../components/Field'
import { parseNumber, toArabicDigits } from '../../lib/format'
import { useAcademies, useData } from '../../data/data'
import { CURRENCIES, validateAcademy, type Academy, type AcademyErrors, type AcademyInput } from '../../domain/academy'
import { PAY_MODE_LABELS, type PayMode } from '../../domain/student'

/** Route: /academies/new and /academies/:id */
export function AcademyFormScreen() {
  const { id } = useParams()
  const { items, loading } = useAcademies()
  if (loading) return null
  if (!id) return <AcademyForm key="new" others={items} />
  const academy = items.find((a) => a.id === id)
  if (!academy) {
    return (
      <section className="empty">
        <h2>الأكاديمية غير موجودة</h2>
        <p>
          <Link to="/academies">ارجع للمستحقات</Link>
        </p>
      </section>
    )
  }
  return <AcademyForm key={academy.id} academy={academy} others={items.filter((a) => a.id !== id)} />
}

function AcademyForm({ academy, others }: { academy?: Academy; others: Academy[] }) {
  const { repos, notify } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState(academy?.name ?? '')
  const [currency, setCurrency] = useState(academy?.currency ?? others[0]?.currency ?? 'جنيه')
  const [payMode, setPayMode] = useState<PayMode>(academy?.payMode ?? 'session')
  const [rate, setRate] = useState(academy ? String(academy.rate) : '')
  const [archived, setArchived] = useState(academy?.archived ?? false)
  const [remindHours, setRemindHours] = useState(academy?.remindHours ?? 0)
  const [errors, setErrors] = useState<AcademyErrors>({})

  function save(e: FormEvent) {
    e.preventDefault()
    const input: AcademyInput = {
      name: name.trim(),
      currency: currency.trim(),
      payMode,
      rate: parseNumber(rate) ?? Number.NaN,
      archived,
      remindHours: remindHours || undefined,
    }
    const found = validateAcademy(input, others)
    setErrors(found)
    if (Object.keys(found).length) return
    if (academy) repos.academies.update(academy.id, input)
    else repos.academies.create(input)
    notify('تم حفظ الأكاديمية')
    navigate('/academies')
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <PageHeader title={academy ? academy.name : 'أكاديمية جديدة'} />

      <Field id="name" label="الاسم" error={errors.name}>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>

      <fieldset className="field">
        <legend>طريقة الحساب</legend>
        <div className="segmented">
          {(Object.keys(PAY_MODE_LABELS) as PayMode[]).map((m) => (
            <label key={m} className="segment">
              <input type="radio" name="payMode" checked={payMode === m} onChange={() => setPayMode(m)} />
              <span>{PAY_MODE_LABELS[m]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-row">
        <Field id="rate" label="السعر" error={errors.rate}>
          <input id="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field id="currency" label="العملة" error={errors.currency}>
          <input id="currency" list="currencies" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <datalist id="currencies">
            {CURRENCIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field id="remind" label="تذكير الطالب قبل الحصة" hint="لو الأكاديمية بتشترط تذكّر الطالب بالحلقة. هيوصلك إشعار في الميعاد ورسالة جاهزة.">
        <select id="remind" value={remindHours} onChange={(e) => setRemindHours(Number(e.target.value))}>
          <option value={0}>مش مطلوب</option>
          {[1, 2, 3, 4, 6, 12, 24].map((h) => (
            <option key={h} value={h}>
              قبلها بـ {toArabicDigits(h)} {h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? 'ساعات' : 'ساعة'}
            </option>
          ))}
        </select>
      </Field>

      {academy && (
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          <span>توقفت عن العمل معها (تختفي من الاختيارات، ويبقى تاريخها)</span>
        </label>
      )}

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
