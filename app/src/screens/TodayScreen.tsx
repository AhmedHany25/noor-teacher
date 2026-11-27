import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Calendar } from '../components/Calendar'
import { LessonRow } from '../components/LessonRow'
import { PageHeader } from '../components/PageHeader'
import { useGroups, useSessions, useStudents } from '../data/data'
import { useMissedLessons } from '../data/useMissed'
import { sessionId } from '../domain/attendance'
import { countryOf } from '../domain/countries'
import { groupTitle, occurrencesOn, studentLocalTime, time12, type Group, type Occurrence } from '../domain/schedule'
import type { Student } from '../domain/student'
import { dateOf, useClock } from '../lib/clock'
import { formatDayName, formatGregorian, formatHijri, longDate, toArabicDigits, untilText } from '../lib/format'

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Route: / — the teacher's hub: a calendar on Egyptian time and the lessons of the chosen day. */
export function TodayScreen() {
  const { timeZone, today, nowTime } = useClock()
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  const { items: sessions } = useSessions()
  const missedAll = useMissedLessons().missed
  const [selected, setSelected] = useState(today)

  const isToday = selected === today
  const lessons = occurrencesOn(groups, selected)
  const active = lessons.filter((o) => !o.cancelledBy)
  const next = isToday ? active.find((o) => o.time >= nowTime) : undefined
  const recorded = active.filter((o) => sessions.some((s) => s.id === sessionId(o.groupId, o.date))).length
  // Earlier days only: today's lessons are already on screen.
  const missed = missedAll.filter((o) => o.date !== today).length
  const groupOf = (o: Occurrence) => groups.find((g) => g.id === o.groupId)!
  const firstName = (g: Group) => students.find((s) => s.id === g.studentIds[0])?.name
  const day = dateOf(selected)

  const header = (
    <PageHeader
      big
      title={formatDayName(day)}
      subtitle={
        <>
          <span>{formatGregorian(day)}</span>
          <span className="band-gold">{formatHijri(day)}</span>
          {!isToday && <span>{selected < today ? 'يوم فات' : 'يوم جاي'}</span>}
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

      <Calendar
        selected={selected}
        today={today}
        onSelect={setSelected}
        countOn={(d) => occurrencesOn(groups, d).filter((o) => !o.cancelledBy).length}
      />

      {isToday && (
        <>
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
              <Link to="/review" className="stat stat-warn" aria-label={`${toArabicDigits(missed)} حصص فاتت من غير تسجيل`}>
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
        </>
      )}

      {!isToday && <h2 className="day-heading">حصص {longDate(selected)}</h2>}

      {lessons.length === 0 ? (
        <section className="empty card">
          <h2>{isToday ? 'لا توجد حصص اليوم' : 'لا توجد حصص في اليوم ده'}</h2>
          <p>{isToday ? 'يوم راحة. اختار يوم تاني من الجدول لو حابب تشوف مواعيده.' : 'اختار يوم تاني من الجدول.'}</p>
        </section>
      ) : (
        <ol className="lessons" aria-label={isToday ? 'حصص اليوم' : `حصص ${longDate(selected)}`}>
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
                canRecord={selected <= today}
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
