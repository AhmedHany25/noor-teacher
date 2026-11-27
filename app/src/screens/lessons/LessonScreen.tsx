import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Field } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { useData, useGroups, useSessions, useStudents } from '../../data/data'
import {
  STATUS_TEXT,
  cancelLesson,
  defaultBillable,
  moveLesson,
  restoreLesson,
  sessionId,
  type AttendanceStatus,
  type Session,
  type StudentAttendance,
} from '../../domain/attendance'
import {
  addDays,
  groupTitle,
  occurrencesOn,
  time12,
  type CancelledBy,
  type Group,
  type GroupException,
  type Occurrence,
} from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'

const DURATIONS = [15, 20, 30, 40, 45, 60, 90, 120]
const STATUSES: AttendanceStatus[] = ['p', 'a', 'e']
const stamp = () => Date.now()

/** Route: /lessons/:groupId/:date */
export function LessonScreen() {
  const { groupId = '', date = '' } = useParams()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: l2 } = useStudents()
  const { items: sessions, loading: l3 } = useSessions()
  if (loading || l2 || l3) return null

  const group = groups.find((g) => g.id === groupId)
  const session = sessions.find((s) => s.id === sessionId(groupId, date))
  const occ = group ? occurrencesOn([group], date)[0] : undefined
  if (!group || (!occ && !session)) {
    return (
      <section className="empty">
        <h2>مفيش حصة في اليوم ده</h2>
        <p>
          ربما اتنقلت أو اتعدّلت مواعيد الحلقة. <Link to="/">ارجع لليوم</Link>
        </p>
      </section>
    )
  }
  // A recorded lesson whose schedule later changed still opens, using what was recorded.
  const lesson: Occurrence = occ ?? {
    groupId,
    date,
    time: session!.time,
    durationMin: group.durationMin,
    kind: session!.kind,
  }
  return <Lesson key={`${groupId}-${date}`} group={group} lesson={lesson} session={session} students={students} />
}

function groupInput(g: Group, exceptions: Record<string, GroupException>) {
  const { id: _id, ...rest } = g
  return { ...rest, exceptions }
}

function Lesson({ group, lesson, session, students }: { group: Group; lesson: Occurrence; session?: Session; students: Student[] }) {
  const { repos, notify } = useData()
  const navigate = useNavigate()
  const location = useLocation()
  const { today } = useClock()
  const upcoming = lesson.date > today
  const title = groupTitle(group, students)
  const people = group.studentIds.map((id) => students.find((s) => s.id === id) ?? { id, name: 'طالب محذوف' })

  const [att, setAtt] = useState<Record<string, StudentAttendance | undefined>>(() => ({ ...session?.attendance }))
  const [duration, setDuration] = useState(session?.actualDurationMin ?? lesson.durationMin)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<'none' | 'cancel' | 'move'>('none')
  const [toDate, setToDate] = useState(addDays(lesson.date, 1))
  const [toTime, setToTime] = useState(lesson.time)

  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  function setStatus(id: string, status: AttendanceStatus) {
    setAtt((a) => ({ ...a, [id]: { status, billable: defaultBillable(status) } }))
  }

  function save() {
    if (people.some((p) => !att[p.id])) {
      setError('حدد الحضور لكل الطلاب.')
      return
    }
    repos.sessions.put(sessionId(group.id, lesson.date), {
      groupId: group.id,
      date: lesson.date,
      time: lesson.time,
      kind: session?.kind ?? lesson.kind,
      attendance: Object.fromEntries(people.map((p) => [p.id, att[p.id]!])),
      actualDurationMin: duration !== lesson.durationMin ? duration : undefined,
      makeupFor: session?.makeupFor ?? lesson.makeupFor,
      note: session?.note,
      updatedAt: stamp(),
    })
    notify('تم حفظ الحضور')
    goBack()
  }

  function clear() {
    repos.sessions.remove(sessionId(group.id, lesson.date))
    setAtt({})
    notify('تم مسح التسجيل')
  }

  function cancel(by: CancelledBy) {
    repos.groups.update(group.id, groupInput(group, cancelLesson(group, lesson.date, by)))
    if (session) repos.sessions.remove(session.id)
    setPanel('none')
    notify('تم إلغاء الحصة')
  }

  function move() {
    if (!toDate || !toTime) return
    repos.groups.update(group.id, groupInput(group, moveLesson(group, lesson.date, toDate, toTime)))
    if (session) repos.sessions.remove(session.id)
    notify('تم نقل الحصة')
    goBack()
  }

  function restore(date: string) {
    repos.groups.update(group.id, groupInput(group, restoreLesson(group, date)))
    notify('رجعت الحصة لموعدها')
  }

  return (
    <div className="form">
      <PageHeader
        title={title}
        subtitle={
          <>
            {longDate(lesson.date)}، {time12(lesson.time)}، {toArabicDigits(lesson.durationMin)} دقيقة
          </>
        }
      />

      {lesson.cancelledBy ? (
        <section className="banner">
          <p>
            الحصة ملغاة: <strong>{lesson.cancelledBy === 'teacher' ? 'ألغيتها أنا' : 'ألغاها الطالب'}</strong>
            {lesson.cancelledBy === 'teacher' && '، وليها حصة تعويض مستحقة.'}
          </p>
          <button type="button" className="btn btn-quiet" onClick={() => restore(lesson.date)}>
            تراجع عن الإلغاء
          </button>
        </section>
      ) : (
        <>
          {lesson.movedFrom && (
            <section className="banner">
              <p>الحصة دي منقولة من {longDate(lesson.movedFrom)}.</p>
              <button type="button" className="btn btn-quiet" onClick={() => restore(lesson.movedFrom!)}>
                تراجع عن النقل
              </button>
            </section>
          )}

          <section className="lesson-section card" aria-label="الحضور">
            <h2 className="lesson-section-title">الحضور</h2>
            {upcoming ? (
              <p className="field-hint">الحصة لسه مجاتش. تقدر تسجّل حضورها في يومها.</p>
            ) : (
              <>
          {people.map((p) => {
            const a = att[p.id]
            return (
              <fieldset key={p.id} className="field att-student" aria-label={p.name}>
                <legend>{p.name}</legend>
                <div className="segmented">
                  {STATUSES.map((s) => (
                    <label key={s} className="segment">
                      <input
                        type="radio"
                        name={`att-${p.id}`}
                        checked={a?.status === s}
                        onChange={() => setStatus(p.id, s)}
                      />
                      <span>{STATUS_TEXT[s]}</span>
                    </label>
                  ))}
                </div>
                {a && a.status !== 'p' && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={a.billable}
                      onChange={(e) => setAtt((x) => ({ ...x, [p.id]: { ...a, billable: e.target.checked } }))}
                    />
                    <span>تُحتسب في المستحقات</span>
                  </label>
                )}
              </fieldset>
            )
          })}

          <Field id="duration" label="المدة الفعلية">
            <select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[...new Set([...DURATIONS, lesson.durationMin, duration])]
                .sort((x, y) => x - y)
                .map((m) => (
                  <option key={m} value={m}>
                    {toArabicDigits(m)} دقيقة
                  </option>
                ))}
            </select>
          </Field>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={save}>
              حفظ الحضور
            </button>
            {session && (
              <button type="button" className="btn btn-quiet" onClick={clear}>
                مسح التسجيل
              </button>
            )}
          </div>
              </>
            )}
          </section>

          {!lesson.movedFrom && (
            <section className="reschedule lesson-section card" aria-label="تغيير الموعد">
              <h2 className="lesson-section-title">تغيير الموعد</h2>
              <div className="reschedule-actions">
                <button type="button" className="btn btn-quiet" onClick={() => setPanel(panel === 'cancel' ? 'none' : 'cancel')}>
                  إلغاء الحصة
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setPanel(panel === 'move' ? 'none' : 'move')}>
                  نقل لموعد آخر
                </button>
              </div>

              {panel === 'cancel' && (
                <div className="reschedule-panel">
                  <p>مين اللي لغى؟ لو إنت، هتتسجل للطالب حصة تعويض مستحقة.</p>
                  <div className="reschedule-actions">
                    <button type="button" className="btn btn-quiet" onClick={() => cancel('student')}>
                      ألغاها الطالب
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => cancel('teacher')}>
                      ألغيتها أنا
                    </button>
                  </div>
                </div>
              )}

              {panel === 'move' && (
                <div className="reschedule-panel">
                  <div className="form-row">
                    <Field id="toDate" label="اليوم الجديد">
                      <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </Field>
                    <Field id="toTime" label="الوقت الجديد">
                      <input id="toTime" type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
                    </Field>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={move}>
                    نقل
                  </button>
                </div>
              )}
              <Link to={`/groups/${group.id}`} className="form-link">
                تعديل الحلقة (الأيام والمواعيد الأساسية)
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  )
}
