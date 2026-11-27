import { PageHeader } from '../../components/PageHeader'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field } from '../../components/Field'
import { useData, useGroups, useStudents } from '../../data/data'
import {
  WEEKDAY_NAMES,
  WEEK_ORDER,
  groupTitle,
  validateGroup,
  type Group,
  type GroupErrors,
  type GroupInput,
  type Weekday,
} from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'

const DURATIONS = [15, 20, 30, 40, 45, 60, 90, 120]

/** Route: /groups/new (optionally ?student=<id>) and /groups/:id */
export function GroupFormScreen() {
  const { id } = useParams()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  if (loading || loadingStudents) return null
  if (!id) return <GroupForm key="new" students={students} lastGroup={groups.at(-1)} />
  const group = groups.find((g) => g.id === id)
  if (!group) {
    return (
      <section className="empty">
        <h2>الحلقة غير موجودة</h2>
        <p>
          <Link to="/groups">ارجع للحلقات</Link>
        </p>
      </section>
    )
  }
  return <GroupForm key={group.id} group={group} students={students} />
}

function GroupForm({ group, students, lastGroup }: { group?: Group; students: Student[]; lastGroup?: Group }) {
  const { repos, notify } = useData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { today } = useClock()

  const [studentIds, setStudentIds] = useState<string[]>(() => {
    if (group) return group.studentIds
    const pre = params.get('student')
    return pre && students.some((s) => s.id === pre) ? [pre] : []
  })
  const [times, setTimes] = useState<Partial<Record<Weekday, string>>>(() =>
    Object.fromEntries((group?.slots ?? []).map((s) => [s.weekday, s.time])),
  )
  const [durationMin, setDurationMin] = useState(group?.durationMin ?? lastGroup?.durationMin ?? 30)
  const [startDate, setStartDate] = useState(group?.startDate ?? today)
  const [name, setName] = useState(group?.name ?? '')
  const [archived, setArchived] = useState(group?.archived ?? false)
  const [errors, setErrors] = useState<GroupErrors>({})

  // Students to choose from: active ones, plus anyone already in this group.
  const choices = students
    .filter((s) => s.status === 'active' || studentIds.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  const lastTime = () => Object.values(times).filter(Boolean).at(-1) ?? lastGroup?.slots[0]?.time ?? '17:00'

  function toggleStudent(id: string) {
    setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function toggleDay(d: Weekday) {
    setTimes((t) => {
      const next = { ...t }
      if (d in next) delete next[d]
      else next[d] = lastTime()
      return next
    })
  }

  function save(e: FormEvent) {
    e.preventDefault()
    const input: GroupInput = {
      name: name.trim() || undefined,
      studentIds,
      startDate,
      endDate: group?.endDate,
      slots: (Object.entries(times) as [string, string][]).map(([d, t]) => ({ weekday: Number(d) as Weekday, time: t })),
      durationMin,
      pausedMonths: group?.pausedMonths ?? [],
      exceptions: group?.exceptions ?? {},
      archived,
    }
    const found = validateGroup(input)
    setErrors(found)
    if (Object.keys(found).length) return
    if (group) repos.groups.update(group.id, input)
    else repos.groups.create(input)
    notify('تم حفظ الحلقة')
    navigate('/groups')
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <PageHeader title={group ? groupTitle(group, students) : 'حلقة جديدة'} />

      <fieldset className={errors.studentIds ? 'field has-error' : 'field'}>
        <legend>الطلاب</legend>
        <div className="checklist">
          {choices.map((s) => (
            <label key={s.id} className="check-chip">
              <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
        {errors.studentIds && <p className="field-error">{errors.studentIds}</p>}
      </fieldset>

      <fieldset className={errors.slots ? 'field has-error' : 'field'}>
        <legend>أيام الحصص ووقت كل يوم</legend>
        <div className="days">
          {WEEK_ORDER.map((d) => {
            const on = d in times
            return (
              <div key={d} className={on ? 'day is-on' : 'day'}>
                <label className="day-toggle">
                  <input type="checkbox" checked={on} onChange={() => toggleDay(d)} />
                  <span>{WEEKDAY_NAMES[d]}</span>
                </label>
                {on && (
                  <input
                    type="time"
                    className="day-time"
                    aria-label={`وقت ${WEEKDAY_NAMES[d]}`}
                    value={times[d] ?? ''}
                    onChange={(e) => setTimes((t) => ({ ...t, [d]: e.target.value }))}
                  />
                )}
              </div>
            )
          })}
        </div>
        {errors.slots && <p className="field-error">{errors.slots}</p>}
      </fieldset>

      <div className="form-row">
        <Field id="duration" label="مدة الحصة">
          <select id="duration" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {toArabicDigits(m)} دقيقة
              </option>
            ))}
          </select>
        </Field>
        <Field id="start" label="تبدأ من" error={errors.startDate}>
          <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>

      <Field id="gname" label="اسم الحلقة" hint="اختياري. لو سبته فاضي هيظهر اسم الطالب.">
        <input id="gname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>

      {group && (
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          <span>انتهت الحلقة (تختفي من الجدول، ويبقى تاريخها)</span>
        </label>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          حفظ
        </button>
        <Link to="/groups" className="btn btn-quiet">
          إلغاء
        </Link>
      </div>
    </form>
  )
}
