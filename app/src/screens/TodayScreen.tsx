import { Link } from 'react-router'
import { LessonRow } from '../components/LessonRow'
import { useGroups, useSessions, useStudents } from '../data/data'
import { sessionId, unrecordedLessons } from '../domain/attendance'
import { countryOf } from '../domain/countries'
import { groupTitle, occurrencesOn, studentLocalTime, time12, todayISO, type Occurrence } from '../domain/schedule'
import { hhmm, useClock } from '../lib/clock'
import { formatDayName, formatGregorian, formatHijri, toArabicDigits } from '../lib/format'

export function TodayScreen() {
  const { now, timeZone } = useClock()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  const { items: sessions } = useSessions()
  const today = todayISO(now)
  const nowTime = hhmm(now)
  const lessons = occurrencesOn(groups, today)
  const next = lessons.find((o) => !o.cancelledBy && o.time >= nowTime)
  // Earlier days only: today's lessons are already on screen.
  const missed = unrecordedLessons(groups, sessions, today, nowTime, 60).filter((o) => o.date !== today).length

  return (
    <>
      <header className="today-head">
        <h1 className="today-day">{formatDayName(now)}</h1>
        <p className="today-dates">
          <span>{formatGregorian(now)}</span>
          <span className="hijri">{formatHijri(now)}</span>
        </p>
      </header>

      {missed > 0 && (
        <Link to="/review" className="notice">
          {toArabicDigits(missed)} {missed === 1 ? 'حصة فاتت من غير تسجيل' : 'حصص فاتت من غير تسجيل'}، سجّلها الآن
        </Link>
      )}

      {loading || loadingStudents ? null : students.length === 0 ? (
        <section className="empty">
          <h2>ابدأ بإضافة طلابك</h2>
          <p>بعدها اعمل لكل طالب حلقة بأيامها ومواعيدها، وحصص كل يوم هتظهر هنا لوحدها.</p>
          <Link to="/students/new" className="btn btn-primary empty-cta">
            أضف طلابك
          </Link>
        </section>
      ) : groups.every((g) => g.archived) ? (
        <section className="empty">
          <h2>اعمل أول حلقة</h2>
          <p>اختار الطالب وأيام الحصص، وحصص كل يوم هتظهر هنا لوحدها.</p>
          <Link to="/groups/new" className="btn btn-primary empty-cta">
            أضف حلقة
          </Link>
        </section>
      ) : lessons.length === 0 ? (
        <section className="empty">
          <h2>لا توجد حصص اليوم</h2>
          <p>يوم راحة. حصصك الجاية هتظهر هنا في يومها.</p>
        </section>
      ) : (
        <ol className="lessons" aria-label="حصص اليوم">
          {lessons.map((o) => {
            const group = groups.find((g) => g.id === o.groupId)!
            return (
              <LessonRow
                key={`${o.groupId}-${o.time}`}
                o={o}
                group={group}
                title={groupTitle(group, students)}
                session={sessions.find((s) => s.id === sessionId(o.groupId, o.date))}
                isNext={o === next}
                localTimes={localTimes(o, group.studentIds, students, timeZone)}
              />
            )
          })}
        </ol>
      )}
    </>
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
