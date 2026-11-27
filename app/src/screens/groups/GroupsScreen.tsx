import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, useStudents } from '../../data/data'
import { WEEKDAY_NAMES, WEEK_ORDER, groupTitle, scheduleText, time12, weekdayOf, type Weekday } from '../../domain/schedule'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'
import { WeekSchedule } from './WeekSchedule'

/** One-letter day marks used on the cards, Saturday first. */
const DAY_MARK: Record<Weekday, string> = { 6: 'س', 0: 'ح', 1: 'ن', 2: 'ث', 3: 'ر', 4: 'خ', 5: 'ج' }

export function GroupsScreen() {
  const { today: todayDate } = useClock()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  const { items: academies } = useAcademies()
  const [day, setDay] = useState<Weekday | null>(null)
  const [params, setParams] = useSearchParams()
  const view = params.get("view") === "week" ? "week" : "list"
  if (loading || loadingStudents) return null

  const today = weekdayOf(todayDate)
  const active = groups
    .filter((g) => !g.archived)
    .map((g) => ({ g, title: groupTitle(g, students) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ar'))
  const ended = groups.filter((g) => g.archived).length
  const perDay = (d: Weekday) => active.filter(({ g }) => g.slots.some((s) => s.weekday === d)).length
  const shown = day === null ? active : active.filter(({ g }) => g.slots.some((s) => s.weekday === day))
  const minutesPerWeek = active.reduce((sum, { g }) => sum + g.slots.length * g.durationMin, 0)

  const payerName = (studentId?: string) => {
    const s = students.find((x) => x.id === studentId)
    if (!s) return undefined
    return s.academyId ? academies.find((a) => a.id === s.academyId)?.name : 'خصوصي'
  }

  return (
    <>
      <PageHeader
        title="الحلقات"
        subtitle={
          active.length ? (
            <>
              <span>{toArabicDigits(active.length)} حلقة</span>
              <span>{toArabicDigits(Math.round((minutesPerWeek / 60) * 10) / 10)} ساعة في الأسبوع</span>
            </>
          ) : undefined
        }
        action={
          students.length > 0 && (
            <Link to="/groups/new" className="btn btn-gold">
              إضافة حلقة
            </Link>
          )
        }
      />

      {students.length > 0 && (
        <div className="tabs view-tabs" role="tablist" aria-label="العرض">
          <button type="button" role="tab" className="tab" aria-selected={view === "list"} onClick={() => setParams({})}>
            الحلقات
          </button>
          <button type="button" role="tab" className="tab" aria-selected={view === "week"} onClick={() => setParams({ view: "week" })}>
            الجدول الأسبوعي
          </button>
        </div>
      )}

      {view === "week" && students.length > 0 ? (
        <WeekSchedule />
      ) : students.length === 0 ? (
        <section className="empty card">
          <h2>أضف طلابك أولًا</h2>
          <p>
            الحلقة بتجمع طالب أو أكتر على مواعيد ثابتة كل أسبوع. <Link to="/students/new">إضافة طالب</Link>
          </p>
        </section>
      ) : active.length === 0 ? (
        <section className="empty card">
          <h2>أضف أول حلقة</h2>
          <p>اختار الطالب وأيام الحصص ووقت كل يوم، وهتظهر الحصص لوحدها في «اليوم».</p>
        </section>
      ) : (
        <>
          <div className="week" role="tablist" aria-label="أيام الأسبوع">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={day === d}
                className={['week-day', d === today && 'is-today', perDay(d) === 0 && 'is-empty'].filter(Boolean).join(' ')}
                onClick={() => setDay(day === d ? null : d)}
              >
                <span className="week-name">{WEEKDAY_NAMES[d]}</span>
                <b className="week-count">{toArabicDigits(perDay(d))}</b>
              </button>
            ))}
          </div>

          {day !== null && (
            <p className="filter-note">
              حلقات يوم {WEEKDAY_NAMES[day]}
              <button type="button" className="link-btn" onClick={() => setDay(null)}>
                عرض الكل
              </button>
            </p>
          )}

          {shown.length === 0 ? (
            <p className="list-empty">مفيش حلقات يوم {day !== null ? WEEKDAY_NAMES[day] : ''}.</p>
          ) : (
            <ul className="group-cards" aria-label="الحلقات">
              {shown.map(({ g, title }) => {
                const days = new Set(g.slots.map((s) => s.weekday))
                const payer = payerName(g.studentIds[0])
                const dayTime = day !== null ? g.slots.find((s) => s.weekday === day)?.time : undefined
                return (
                  <li key={g.id} className="group-card">
                    <Link to={`/groups/${g.id}`} className="group-link">
                      <div className="group-top">
                        <Avatar name={students.find((s) => s.id === g.studentIds[0])?.name ?? title} />
                        <div className="group-text">
                          <span className="group-title">{title}</span>
                          {payer && <span className="group-payer">{payer}</span>}
                        </div>
                        <span className="pill">{dayTime ? time12(dayTime) : `${toArabicDigits(g.durationMin)} دقيقة`}</span>
                      </div>
                      <div className="day-dots" aria-hidden="true">
                        {WEEK_ORDER.map((d) => (
                          <span key={d} className={days.has(d) ? 'dot is-on' : 'dot'}>
                            {DAY_MARK[d]}
                          </span>
                        ))}
                      </div>
                      <span className="group-schedule">
                        <span>{scheduleText(g.slots)}</span>
                        {dayTime && <span>{toArabicDigits(g.durationMin)} دقيقة</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      {ended > 0 && <p className="section-note">{toArabicDigits(ended)} حلقة منتهية محفوظة في التاريخ.</p>}
    </>
  )
}
