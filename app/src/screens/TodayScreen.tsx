import { Link } from 'react-router'
import { BookIcon, CashIcon, CircleIcon, ReportIcon, WeekIcon } from '../components/icons'
import { PageHeader } from '../components/PageHeader'
import { StudentRemindersCard } from '../components/StudentRemindersCard'
import { useGroups, useSessions, useStudents } from '../data/data'
import { useMissedLessons } from '../data/useMissed'
import { STATUS_TEXT, lessonStatus, sessionId, type Session } from '../domain/attendance'
import { countryOf } from '../domain/countries'
import { groupTitle, occurrencesOn, studentLocalTime, time12, type Occurrence } from '../domain/schedule'
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

  const reportsTo = reportsDue > 0 ? '/reports/parents' : '/reports'

  return (
    <>
      {header}

      <nav className="shortcuts" aria-label="اختصارات">
        <Link to="/groups" className="shortcut">
          <span className="shortcut-icon"><CircleIcon /></span>
          الحلقات
        </Link>
        <Link to="/groups?view=week" className="shortcut">
          <span className="shortcut-icon"><WeekIcon /></span>
          الجدول
        </Link>
        <Link
          to={reportsTo}
          className="shortcut"
          aria-label={reportsDue > 0 ? `التقارير، فاضل ${toArabicDigits(reportsDue)} تقرير شهري من ${toArabicDigits(activeStudents)}` : 'التقارير'}
        >
          <span className="shortcut-icon">
            <ReportIcon />
            {reportsDue > 0 && <span className="shortcut-badge">{toArabicDigits(reportsDue)}</span>}
          </span>
          التقارير
        </Link>
        <Link to="/payments/new" className="shortcut" aria-label="تسجيل مبلغ مستلم">
          <span className="shortcut-icon"><CashIcon /></span>
          مبلغ
        </Link>
        <Link to={next ? `/mushaf?student=${groupOf(next).studentIds[0]}` : '/mushaf'} className="shortcut" aria-label={next ? 'المصحف لطالب الحصة الجاية' : 'المصحف'}>
          <span className="shortcut-icon"><BookIcon /></span>
          المصحف
        </Link>
      </nav>

      {active.length > 0 || missed > 0 ? (
        <section className="day-card" aria-label="الحصة الجاية">
          {next ? (
            <Link to={`/lessons/${next.groupId}/${next.date}`} className="day-next" aria-label={`الحصة الجاية: ${groupTitle(groupOf(next), students)}`}>
              <b>{minutesOf(next.time) <= minutesOf(nowTime) ? 'الحصة الجاية دلوقتي' : `الحصة الجاية بعد ${untilText(minutesOf(next.time) - minutesOf(nowTime))}`}</b>
              <span>
                {groupTitle(groupOf(next), students)}، {time12(next.time)}
              </span>
            </Link>
          ) : active.length > 0 ? (
            <p className="day-next">
              <b>خلصت حصص النهارده</b>
              <span>{recorded === active.length ? 'كلها متسجلة' : `فاضل تسجيل ${toArabicDigits(active.length - recorded)}`}</span>
            </p>
          ) : null}
          {active.length > 0 && (
            <div className="day-progress">
              <div className="day-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((recorded / active.length) * 100)}%` }} />
              </div>
              <span className="field-hint">
                {toArabicDigits(recorded)} من {toArabicDigits(active.length)} اتسجلت
              </span>
            </div>
          )}
          {missed > 0 && (
            <Link to="/attendance?status=none&preset=month" className="tag tag-warn day-missed" aria-label={`${toArabicDigits(missed)} حصص فاتت من غير تسجيل`}>
              {toArabicDigits(missed)} {missed === 1 ? 'حصة فاتت' : 'حصص فاتت'}، سجّلها
            </Link>
          )}
        </section>
      ) : null}

      <StudentRemindersCard />

      {lessons.length === 0 ? (
        <section className="empty card">
          <h2>لا توجد حصص اليوم</h2>
          <p>
            يوم راحة. مواعيد باقي الأيام في <Link to="/attendance">الحضور والغياب</Link>.
          </p>
        </section>
      ) : (
        <ol className="timeline" aria-label="حصص اليوم">
          {lessons.map((o, i) => {
            const group = groupOf(o)
            const showNow = o.time > nowTime && (i === 0 || lessons[i - 1].time <= nowTime)
            return (
              <TimelineRow
                key={`${o.groupId}-${o.time}`}
                o={o}
                title={groupTitle(group, students)}
                session={sessions.find((s) => s.id === sessionId(o.groupId, o.date))}
                isNext={o === next}
                past={o.time <= nowTime}
                showNow={showNow && i > 0}
                href={`/attendance?date=${today}&focus=${o.groupId}`}
                localTimes={localTimes(o, group.studentIds, students, timeZone)}
              />
            )
          })}
        </ol>
      )}
    </>
  )
}

const KIND_TEXT = { regular: '', makeup: 'تعويض', trial: 'تجريبية' } as const

/** One lesson on today's timeline: time, a dot coloured by its state, and a small card. */
function TimelineRow({
  o,
  title,
  session,
  isNext,
  past,
  showNow,
  href,
  localTimes,
}: {
  o: Occurrence
  title: string
  session?: Session
  isNext: boolean
  past: boolean
  showNow: boolean
  href: string
  localTimes: string[]
}) {
  const status = lessonStatus(session)
  const state = o.cancelledBy ? 'cancelled' : status ? status : isNext ? 'next' : past ? 'due' : 'later'
  return (
    <li className={`tl-row tl-${state}`} id={`lesson-${o.groupId}`}>
      {showNow && (
        <span className="tl-now" aria-hidden="true">
          <span>دلوقتي</span>
        </span>
      )}
      <span className="tl-time">{time12(o.time)}</span>
      <span className="tl-dot" aria-hidden="true" />
      <Link to={href} className="tl-card">
        <span className="tl-main">
          <span className="tl-title">{title}</span>
          <span className="tl-meta">
            {toArabicDigits(o.durationMin)} دقيقة
            {localTimes.map((t) => ` · ${t}`).join('')}
          </span>
        </span>
        <span className="tl-tags">
          {KIND_TEXT[o.kind] && <span className="tag">{KIND_TEXT[o.kind]}</span>}
          {o.movedFrom && <span className="tag">منقولة</span>}
          {o.cancelledBy ? (
            <span className="tag tag-muted">ملغاة</span>
          ) : status && status !== 'mixed' ? (
            <span className={`tag att-tag-${status}`}>{STATUS_TEXT[status]}</span>
          ) : status === 'mixed' ? (
            <span className="tag">اتسجل الحضور</span>
          ) : isNext ? (
            <span className="tag tag-next">الحصة الجاية</span>
          ) : past ? (
            <span className="tag tag-warn">سجّل</span>
          ) : null}
        </span>
      </Link>
    </li>
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
