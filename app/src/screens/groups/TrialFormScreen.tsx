import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Field } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useData, useStudents } from '../../data/data'
import type { GroupInput } from '../../domain/schedule'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'

const NEW = '__new'
const DURATIONS = [15, 20, 30, 40, 45, 60]

/** The next round hour after now, as "HH:00". */
function nextHour(nowTime: string): string {
  const h = Math.min(23, Number(nowTime.slice(0, 2)) + 1)
  return `${String(h).padStart(2, '0')}:00`
}

/**
 * Route: /trial/new — a one-off trial lesson in a few taps: who, when, and whether it is paid.
 * Saved as a group with no weekly days and a single extra lesson, so it never repeats.
 */
export function TrialFormScreen() {
  const { repos, notify } = useData()
  const navigate = useNavigate()
  const { today, nowTime } = useClock()
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const [who, setWho] = useState('')
  const [name, setName] = useState('')
  const [academyId, setAcademyId] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState(() => nextHour(nowTime))
  const [durationMin, setDurationMin] = useState(30)
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState('')
  if (loading) return null

  const choices = students.filter((s) => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  const isNew = who === NEW || choices.length === 0

  function save(e: FormEvent) {
    e.preventDefault()
    if (isNew ? !name.trim() : !who) return setError(isNew ? 'اكتب اسم الطالب.' : 'اختار الطالب.')
    if (!date || !time) return setError('حدد اليوم والساعة.')
    const studentId = isNew ? repos.students.create({ name: name.trim(), academyId: academyId || null, status: 'active' }) : who
    const group: GroupInput = {
      studentIds: [studentId],
      startDate: date,
      endDate: date,
      slots: [],
      durationMin,
      pausedMonths: [],
      exceptions: { [date]: { type: 'extra', time, kind: 'trial' } },
      archived: false,
      trial: { paid },
    }
    repos.groups.create(group)
    notify('اتعملت الحصة التجريبية')
    navigate('/')
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <PageHeader title="حصة تجريبية" subtitle="مرة واحدة، مش بتتكرر" />

      {choices.length > 0 && (
        <Field id="who" label="الطالب">
          <select id="who" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">اختار…</option>
            <option value={NEW}>+ طالب جديد</option>
            {choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {isNew && (
        <div className="form-row">
          <Field id="tname" label="اسم الطالب الجديد">
            <input id="tname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field id="tacademy" label="الجهة">
            <select id="tacademy" value={academyId} onChange={(e) => setAcademyId(e.target.value)}>
              <option value="">خصوصي</option>
              {academies
                .filter((a) => !a.archived)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      )}

      <div className="form-row">
        <Field id="tdate" label="اليوم">
          <input id="tdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id="ttime" label="الساعة (بتوقيت مصر)">
          <input id="ttime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      <Field id="tdur" label="المدة">
        <select id="tdur" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              {toArabicDigits(m)} دقيقة
            </option>
          ))}
        </select>
      </Field>

      <label className="check">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        <span>داخلة في المستحقات (مدفوعة)</span>
      </label>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          حفظ
        </button>
        <Link to="/" className="btn btn-quiet">
          إلغاء
        </Link>
      </div>
      {isNew && <p className="field-hint">لو كمّل معاك، اعمله حلقة عادية من صفحته بعد الحصة.</p>}
    </form>
  )
}
