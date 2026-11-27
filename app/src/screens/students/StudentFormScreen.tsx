import { PageHeader } from '../../components/PageHeader'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Field } from '../../components/Field'
import { parseNumber } from '../../lib/format'
import { useAcademies, useData, useStudents } from '../../data/data'
import { COUNTRIES } from '../../domain/countries'
import {
  PAY_MODE_LABELS,
  STATUS_LABELS,
  validateStudent,
  type PayMode,
  type Student,
  type StudentErrors,
  type StudentInput,
  type StudentStatus,
} from '../../domain/student'

type Draft = {
  name: string
  guardianPhone: string
  timeZone: string
  academyId: string
  payMode: string
  rate: string
  level: string
  age: string
  notes: string
  status: StudentStatus
}

function toDraft(s?: Student): Draft {
  return {
    name: s?.name ?? '',
    guardianPhone: s?.guardianPhone ?? '',
    timeZone: s?.timeZone ?? '',
    academyId: s?.academyId ?? '',
    payMode: s?.payMode ?? '',
    rate: s?.rate === undefined ? '' : String(s.rate),
    level: s?.level ?? '',
    age: s?.age === undefined ? '' : String(s.age),
    notes: s?.notes ?? '',
    status: s?.status ?? 'active',
  }
}

const opt = (v: string) => (v.trim() ? v.trim() : undefined)

function toInput(d: Draft): StudentInput {
  return {
    name: d.name.trim(),
    guardianPhone: opt(d.guardianPhone),
    timeZone: opt(d.timeZone),
    academyId: d.academyId || null,
    payMode: (d.payMode || undefined) as PayMode | undefined,
    rate: parseNumber(d.rate),
    level: opt(d.level),
    age: parseNumber(d.age),
    notes: opt(d.notes),
    status: d.status,
  }
}

/** Route: /students/new and /students/:id */
export function StudentFormScreen() {
  const { id } = useParams()
  const { items: students, loading } = useStudents()

  if (!id) return <StudentForm key="new" />
  if (loading) return null
  const student = students.find((s) => s.id === id)
  if (!student) {
    return (
      <section className="empty">
        <h2>الطالب غير موجود</h2>
        <p>
          ربما تم تعديل البيانات من جهاز آخر. <Link to="/students">ارجع لقائمة الطلاب</Link>.
        </p>
      </section>
    )
  }
  return <StudentForm key={student.id} student={student} />
}

function StudentForm({ student }: { student?: Student }) {
  const { repos, notify } = useData()
  const { items: academies } = useAcademies()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft>(() => toDraft(student))
  const [errors, setErrors] = useState<StudentErrors>({})

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const payers = academies.filter((a) => !a.archived || a.id === student?.academyId)
  // Optional details start folded unless the student already has some; errors inside force them open.
  const [moreOpen, setMoreOpen] = useState(() => !!(draft.level || draft.age || draft.payMode || draft.rate || draft.notes))
  const showMore = moreOpen || !!(errors.age || errors.rate)

  function save(e: FormEvent) {
    e.preventDefault()
    const input = toInput(draft)
    const found = validateStudent(input)
    setErrors(found)
    if (Object.keys(found).length) return
    if (student) repos.students.update(student.id, input)
    else repos.students.create(input)
    notify('تم حفظ الطالب')
    navigate(student ? `/students/${student.id}` : '/students')
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <PageHeader title={student ? student.name : 'طالب جديد'} />

      <Field id="name" label="الاسم" error={errors.name}>
        <input id="name" value={draft.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
      </Field>

      <Field id="phone" label="واتساب ولي الأمر" error={errors.guardianPhone} hint="بالصيغة المحلية أو الدولية">
        <input
          id="phone"
          type="tel"
          dir="ltr"
          inputMode="tel"
          value={draft.guardianPhone}
          onChange={(e) => set('guardianPhone', e.target.value)}
          placeholder="01012345678"
        />
      </Field>

      <div className="form-row">
        <Field id="country" label="البلد">
          <select id="country" value={draft.timeZone} onChange={(e) => set('timeZone', e.target.value)}>
            <option value="">نفس بلدي</option>
            {COUNTRIES.map((c) => (
              <option key={c.timeZone} value={c.timeZone}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="payer" label="جهة الدفع" hint={<Link to="/academies/new">إضافة أكاديمية</Link>}>
          <select id="payer" value={draft.academyId} onChange={(e) => set('academyId', e.target.value)}>
            <option value="">خصوصي</option>
            {payers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="field">
        <legend>الحالة</legend>
        <div className="segmented">
          {(Object.keys(STATUS_LABELS) as StudentStatus[]).map((s) => (
            <label key={s} className="segment">
              <input type="radio" name="status" checked={draft.status === s} onChange={() => set('status', s)} />
              <span>{STATUS_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className="more" open={showMore} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>تفاصيل إضافية</summary>
        <div className="more-body">
      <div className="form-row">
        <Field id="level" label="المستوى">
          <input id="level" value={draft.level} onChange={(e) => set('level', e.target.value)} placeholder="مثل: جزء عمّ" />
        </Field>
        <Field id="age" label="العمر" error={errors.age}>
          <input id="age" inputMode="numeric" value={draft.age} onChange={(e) => set('age', e.target.value)} />
        </Field>
      </div>

      <fieldset className="field form-group">
        <legend>سعر خاص لهذا الطالب</legend>
        <p className="field-hint">اتركه فارغًا ليُحسب بسعر جهة الدفع.</p>
        <div className="form-row">
          <Field id="payMode" label="طريقة الحساب">
            <select id="payMode" value={draft.payMode} onChange={(e) => set('payMode', e.target.value)}>
              <option value="">مثل جهة الدفع</option>
              {(Object.keys(PAY_MODE_LABELS) as PayMode[]).map((m) => (
                <option key={m} value={m}>
                  {PAY_MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="rate" label="السعر" error={errors.rate}>
            <input id="rate" inputMode="decimal" value={draft.rate} onChange={(e) => set('rate', e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <Field id="notes" label="ملاحظات">
        <textarea id="notes" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
        </div>
      </details>

      {student && (
        <p className="form-link">
          <Link to={`/groups/new?student=${student.id}`}>عمل حلقة لهذا الطالب</Link>
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          حفظ
        </button>
        <Link to="/students" className="btn btn-quiet">
          إلغاء
        </Link>
      </div>
    </form>
  )
}

