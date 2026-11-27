import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Calendar } from '../../components/Calendar'
import { LessonRow } from '../../components/LessonRow'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, useSessions, useStudents } from '../../data/data'
import {
  STATE_TEXT,
  countStates,
  filterLessons,
  lessonsInRange,
  presetRange,
  type LessonState,
  type Preset,
} from '../../domain/attendanceList'
import { groupTitle, occurrencesOn } from '../../domain/schedule'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'
import { BatchStarts } from './BatchStarts'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'النهارده' },
  { value: 'yesterday', label: 'امبارح' },
  { value: 'week', label: 'الأسبوع ده' },
  { value: 'month', label: 'الشهر ده' },
  { value: 'custom', label: 'فترة' },
]
const STATES: LessonState[] = ['none', 'p', 'a', 'e', 'upcoming', 'cancelled']

/**
 * Route: /attendance — every lesson of a period with its attendance, filters and quick recording.
 * Query: ?date=YYYY-MM-DD (one day) &focus=<groupId> (highlight) &status=none|p|a|e|cancelled &preset=…
 */
export function AttendanceScreen() {
  const { today, nowTime } = useClock()
  const [params] = useSearchParams()
  const { items: groups, loading } = useGroups()
  const { items: students } = useStudents()
  const { items: academies } = useAcademies()
  const { items: sessions, loading: l2 } = useSessions()

  const date = params.get('date')
  const [preset, setPreset] = useState<Preset>(() => (date ? 'custom' : ((params.get('preset') as Preset) ?? 'week')))
  const [custom, setCustom] = useState(() => ({ from: date ?? today, to: date ?? today }))
  const [studentId, setStudentId] = useState('')
  const [payer, setPayer] = useState('')
  const [state, setState] = useState<LessonState | ''>(() => (params.get('status') as LessonState) ?? '')
  const focus = params.get('focus')

  useEffect(() => {
    if (!focus) return
    document.getElementById(`lesson-${focus}`)?.scrollIntoView?.({ block: 'center' })
  }, [focus, loading, l2])

  if (loading || l2) return null

  const range = presetRange(preset, today, custom)
  const all = lessonsInRange(groups, sessions, range.from, range.to, { today, time: nowTime })
  const forCounts = filterLessons(all, groups, students, { studentId: studentId || undefined, payer: payer || undefined })
  const shown = state ? forCounts.filter((x) => x.state === state) : forCounts
  const counts = countStates(forCounts)
  const days = [...new Set(shown.map((x) => x.o.date))]
  const single = range.from === range.to

  function pickDay(d: string) {
    setPreset('custom')
    setCustom({ from: d, to: d })
  }

  return (
    <>
      <PageHeader
        title="الحضور والغياب"
        subtitle={single ? longDate(range.from) : `${longDate(range.from)} إلى ${longDate(range.to)}`}
      />

      <Calendar
        selected={single ? range.from : today}
        today={today}
        onSelect={pickDay}
        countOn={(d) => occurrencesOn(groups, d).filter((o) => !o.cancelledBy).length}
      />

      <section className="filters card" aria-label="الفلاتر">
        <div className="chip-row" role="group" aria-label="الفترة">
          {PRESETS.map((p) => (
            <button key={p.value} type="button" className="chip" aria-pressed={preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="form-row">
            <label className="field">
              <span>من</span>
              <input type="date" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className="field">
              <span>إلى</span>
              <input type="date" value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
          </div>
        )}
        <div className="form-row">
          <select aria-label="الطالب" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">كل الطلاب</option>
            {students
              .filter((s) => s.status === 'active')
              .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <select aria-label="الجهة" value={payer} onChange={(e) => setPayer(e.target.value)}>
            <option value="">كل الجهات</option>
            {academies
              .filter((a) => !a.archived)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            <option value="private">خصوصي</option>
          </select>
        </div>
      </section>

      <div className="state-chips" role="group" aria-label="الحالة">
        <button type="button" className="state-chip" aria-pressed={state === ''} onClick={() => setState('')}>
          الكل <b>{toArabicDigits(counts.total)}</b>
        </button>
        {STATES.map((s) => (
          <button key={s} type="button" className={`state-chip st-${s}`} aria-pressed={state === s} onClick={() => setState(state === s ? '' : s)}>
            {STATE_TEXT[s]} <b>{toArabicDigits(counts[s])}</b>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <section className="empty card">
          <p>{state === 'none' ? 'كل حصص الفترة دي متسجلة.' : 'مفيش حصص بالفلاتر دي.'}</p>
        </section>
      ) : (
        <section aria-label="الحصص">
          {days.map((d) => (
            <div key={d} className="review-day">
              <h2 className="day-heading">
                {longDate(d)}
                {d === today && <span className="tag">النهارده</span>}
              </h2>
              <ol className="lessons" aria-label={`حصص ${longDate(d)}`}>
                {shown
                  .filter((x) => x.o.date === d)
                  .map(({ o, session }) => {
                    const group = groups.find((x) => x.id === o.groupId)!
                    return (
                      <LessonRow
                        key={`${o.groupId}-${o.time}`}
                        o={o}
                        group={group}
                        title={groupTitle(group, students)}
                        avatarName={students.find((s) => s.id === group.studentIds[0])?.name}
                        session={session}
                        canRecord={d <= today}
                        focused={focus === o.groupId && single}
                        showDetails
                      />
                    )
                  })}
              </ol>
            </div>
          ))}
        </section>
      )}

      <BatchStarts />
    </>
  )
}
