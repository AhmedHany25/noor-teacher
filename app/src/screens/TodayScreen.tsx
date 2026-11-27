import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { LessonRow } from '../components/LessonRow'
import { PageHeader } from '../components/PageHeader'
import { StudentRemindersCard } from '../components/StudentRemindersCard'
import { useGroups, useSessions, useStudents } from '../data/data'
import { useMissedLessons } from '../data/useMissed'
import { sessionId } from '../domain/attendance'
import { countryOf } from '../domain/countries'
import { groupTitle, monthLabel, occurrencesOn, studentLocalTime, time12, type Group, type Occurrence } from '../domain/schedule'
import type { Student } from '../domain/student'
import { dateOf, useClock } from '../lib/clock'
import { formatDayName, formatGregorian, formatHijri, toArabicDigits, untilText } from '../lib/format'

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Route: / — today only: the next lesson, today's numbers and today's lessons in time order. */
export function TodayScreen() {
  const { timeZone, today, nowTime } = useClock()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  const { items: sessions } = useSessions()
  const missedAll = useMissedLessons().missed
  const lessons = occurrencesOn(groups, today)
  const active = lessons.filter((o) => !o.cancelledBy)
  const next = active.find((o) => o.time >= nowTime)
  const recorded = active.filter((o) => sessions.some((s) => s.id === sessionId(o.groupId, o.date))).length
  // Earlier days only: today's lessons are already on screen.
  const missed = missedAll.filter((o) => o.date !== today).length
  const groupOf = (o: Occurrence) => groups.find((g) => g.id === o.groupId)!
  const firstName = (g: Group) => students.find((s) => s.id === g.studentIds[0])?.name
  const day = dateOf(today)
  // In the last days of the month, remind about monthly reports not sent yet.
  const activeStudents = students.filter((x) => x.status === 'active').length
  const reportsDue = Number(today.slice(8)) >= 25 ? students.filter((x) => x.status === 'active' && !x.reportsSent?.[today.slice(0, 7)]).length : 0

  const header = (
    <PageHeader
      big
      title={formatDayName(day)}
      subtitle={
        <>
          <span>{formatGregorian(day)}</span>
          <span className="band-gold">{formatHijri(day)}</span>
        </>
      }
    />
  )

  if (loading || loadingStudents) return header

  if (students.length === 0) {
    return (
      <>
        {header}
        <section className="empty card">
          <h2>ابدأ بإضافة طلابك</h2>
          <p>بعدها اعمل لكل طالب حلقة بأيامها ومواعيدها، وحصص كل يوم هتظهر هنا لوحدها.</p>
          <Link to="/students/new" className="btn btn-primary empty-cta">
            أضف طلابك
          </Link>
        </section>
      </>
    )
  }

  if (groups.every((g) => g.archived)) {
    return (
      <>
        {header}
        <section className="empty card">
          <h2>اعمل أول حلقة</h2>
          <p>اختار الطالب وأيام الحصص، وحصص كل يوم هتظهر هنا لوحدها.</p>
          <Link to="/groups/new" className="btn btn-primary empty-cta">
            أضف حلقة
          </Link>
        </section>
      </>
    )
  }

  return (
    <>
      {header}


          {next ? (
            <NextLesson o={next} group={groupOf(next)} students={students} teacherTz={timeZone} wait={minutesOf(next.time) - minutesOf(nowTime)} />
          ) : (
            active.length > 0 && (
              <section className="hero hero-done" aria-label="الحصة الجاية">
                <p className="hero-label">خلصت حصص النهارده</p>
                <p className="hero-big">
                  {recorded === active.length ? 'كلها متسجلة' : `فاضل تسجيل ${toArabicDigits(active.length - recorded)}`}
                </p>
              </section>
            )
          )}

          <StudentRemindersCard />

          {reportsDue > 0 && (
            <Link to="/reports/parents" className="notice">
              التقارير الشهرية لـ{monthLabel(today.slice(0, 7))} جاهزة: فاضل {toArabicDigits(reportsDue)} من {toArabicDigits(activeStudents)}
            </Link>
          )}

          <div className="stats">
            <div className="stat">
              <b>{toArabicDigits(active.length)}</b>
              <span>حصص اليوم</span>
            </div>
            <div className="stat stat-good">
              <b>{toArabicDigits(recorded)}</b>
              <span>اتسجلت</span>
            </div>
            {missed > 0 ? (
              <Link to="/attendance?status=none&preset=month" className="stat stat-warn" aria-label={`${toArabicDigits(missed)} حصص فاتت من غير تسجيل`}>
                <b>{toArabicDigits(missed)}</b>
                <span>فاتت، سجّلها</span>
              </Link>
            ) : (
              <div className="stat">
                <b>٠</b>
                <span>فاتت</span>
              </div>
            )}
          </div>

      {lessons.length === 0 ? (
        <section className="empty card">
          <h2>لا توجد حصص اليوم</h2>
          <p>
            يوم راحة. مواعيد باقي الأيام في <Link to="/attendance">الحضور والغياب</Link>.
          </p>
        </section>
      ) : (
        <ol className="lessons" aria-label="حصص اليوم">
          {lessons.map((o) => {
            const group = groupOf(o)
            return (
              <LessonRow
                key={`${o.groupId}-${o.time}`}
                o={o}
                group={group}
                title={groupTitle(group, students)}
                avatarName={firstName(group)}
                session={sessions.find((s) => s.id === sessionId(o.groupId, o.date))}
                isNext={o === next}
                compact
                linkTo={`/attendance?date=${today}&focus=${o.groupId}`}
                localTimes={localTimes(o, group.studentIds, students, timeZone)}
              />
            )
          })}
        </ol>
      )}
    </>
  )
}

function NextLesson({
  o,
  group,
  students,
  teacherTz,
  wait,
}: {
  o: Occurrence
  group: Group
  students: Student[]
  teacherTz: string
  wait: number
}) {
  const title = groupTitle(group, students)
  const first = students.find((s) => s.id === group.studentIds[0])?.name ?? title
  const local = localTimes(o, group.studentIds, students, teacherTz)
  return (
    <Link to={`/lessons/${o.groupId}/${o.date}`} className="hero" aria-label={`الحصة الجاية: ${title}`}>
      <p className="hero-label">{wait < 1 ? 'الحصة الجاية' : 'الحصة الجاية بعد'}</p>
      <p className="hero-big">{untilText(wait)}</p>
      <div className="hero-who">
        <Avatar name={first} size="lg" />
        <div>
          <b>{title}</b>
          <span>
            {time12(o.time)}، {toArabicDigits(o.durationMin)} دقيقة{local.length ? `، ${local.join('، ')}` : ''}
          </span>
        </div>
      </div>
    </Link>
  )
}

function localTimes(
  o: Occurrence,
  studentIds: string[],
  students: { id: string; timeZone?: string }[],
  teacherTz: string,
): string[] {
  const zones = new Set(
    studentIds
      .map((id) => students.find((s) => s.id === id)?.timeZone)
      .filter((tz): tz is string => !!tz && tz !== teacherTz),
  )
  return [...zones].map((tz) => `${time12(studentLocalTime(o.date, o.time, teacherTz, tz))} في ${countryOf(tz)?.name ?? tz}`)
}
