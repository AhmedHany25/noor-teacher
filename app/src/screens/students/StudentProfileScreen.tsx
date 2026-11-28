import { Link, useParams } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, useSessions, useStudents } from '../../data/data'
import { STATUS_TEXT } from '../../domain/attendance'
import { DEFAULT_TIME_ZONE } from '../../domain/countries'
import { encodePlan, planFor } from '../../domain/games'
import { RATING_TEXT, previousHomework } from '../../domain/notes'
import { studentProgress } from '../../domain/progress'
import { rangeText, surahName } from '../../domain/quran'
import { scheduleText } from '../../domain/schedule'
import { STATUS_LABELS, whatsappNumber } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'

const RECENT = 10

/** Route: /students/:id — the student's file: progress, homework, mistakes, lessons. */
export function StudentProfileScreen() {
  const { id = '' } = useParams()
  const { today } = useClock()
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const { items: groups } = useGroups()
  const { items: sessions, loading: l2 } = useSessions()
  if (loading || l2) return null

  const s = students.find((x) => x.id === id)
  if (!s) {
    return (
      <section className="empty card">
        <h2>الطالب غير موجود</h2>
        <p>
          <Link to="/students">ارجع لقائمة الطلاب</Link>
        </p>
      </section>
    )
  }

  const p = studentProgress(sessions, s.id, today.slice(0, 7))
  const homework = previousHomework(sessions, s.id, '9999-12-31')
  const payer = s.academyId ? (academies.find((a) => a.id === s.academyId)?.name ?? 'أكاديمية') : 'خصوصي'
  const myGroups = groups.filter((g) => !g.archived && !g.trial && g.studentIds.includes(s.id))
  const wa = s.guardianPhone ? whatsappNumber(s.guardianPhone, s.timeZone, DEFAULT_TIME_ZONE) : null

  return (
    <>
      <PageHeader
        title={s.name}
        subtitle={
          <>
            <span>{payer}</span>
            <span>{STATUS_LABELS[s.status]}</span>
            {s.level && <span>{s.level}</span>}
          </>
        }
        action={
          <Link to={`/students/${s.id}/edit`} className="btn btn-gold">
            تعديل البيانات
          </Link>
        }
      />

      <section className="stats stats-4" aria-label={`تقدّم ${s.name}`}>
        <div className="stat stat-good">
          <b>{toArabicDigits(p.month.ayat)}</b>
          <span>آية الشهر ده</span>
        </div>
        <div className="stat">
          <b>{toArabicDigits(p.totalAyat)}</b>
          <span>آية إجمالي</span>
        </div>
        <div className="stat">
          <b>{p.month.attendanceRate === undefined ? '—' : `${toArabicDigits(p.month.attendanceRate)}٪`}</b>
          <span>حضور الشهر</span>
        </div>
        <div className="stat">
          <b className="stat-text">{p.lastPosition ? `${surahName(p.lastPosition.s)} ${toArabicDigits(p.lastPosition.a)}` : '—'}</b>
          <span>آخر موضع</span>
        </div>
      </section>

      <div className="profile-actions">
        {wa && (
          <a className="btn btn-quiet btn-wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            واتساب ولي الأمر
          </a>
        )}
        <Link className="btn btn-quiet" to="/reports/parents">
          التقرير الشهري
        </Link>
        <Link
          className="btn btn-quiet"
          to={`/mushaf?student=${s.id}&s=${p.lastPosition?.s ?? 1}${p.lastPosition ? `&a=${p.lastPosition.a}` : ''}`}
        >
          المصحف بأخطائه
        </Link>
        <Link className="btn btn-quiet" to={`/groups/new?student=${s.id}`}>
          حلقة جديدة
        </Link>
      </div>

      {homework && (
        <section className="lesson-section card" aria-label="الواجب الحالي">
          <h2 className="lesson-section-title">الواجب الحالي</h2>
          <p>
            <b>{homework.text}</b>
            <span className="field-hint"> (من حصة {longDate(homework.date)})</span>
          </p>
        </section>
      )}

      <GamesCard name={s.name} plan={planFor(s.name, sessions, s.id)} phone={wa} />

      {p.repeated.length > 0 && (
        <section className="lesson-section card" aria-label="مواضع تحتاج مراجعة">
          <h2 className="lesson-section-title">مواضع تحتاج مراجعة</h2>
          <ul className="mistake-list">
            {p.repeated.map((m) => (
              <li key={`${m.s}:${m.a}`} className="mistake">
                <Link to={`/mushaf?student=${s.id}&s=${m.s}&a=${m.a}`}>
                  {surahName(m.s)} {toArabicDigits(m.a)}
                </Link>
                <span className="tag tag-warn">{toArabicDigits(m.count)} مرات</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myGroups.length > 0 && (
        <section className="lesson-section card" aria-label="الحلقات">
          <h2 className="lesson-section-title">الحلقات</h2>
          <ul className="plain-list">
            {myGroups.map((g) => (
              <li key={g.id}>
                <Link to={`/groups/${g.id}`}>{scheduleText(g.slots)}</Link>
                <span className="field-hint"> ({toArabicDigits(g.durationMin)} دقيقة)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="lesson-section card" aria-label="آخر الحصص">
        <h2 className="lesson-section-title">آخر الحصص</h2>
        {p.recent.length === 0 ? (
          <p className="field-hint">مفيش حصص متسجلة لسه.</p>
        ) : (
          <ul className="history">
            {p.recent.slice(0, RECENT).map((x) => {
              const st = x.attendance[s.id]?.status
              const n = x.notes?.[s.id]
              return (
                <li key={x.id}>
                  <Link to={`/lessons/${x.groupId}/${x.date}`} className="history-link">
                    <span className="history-date">{longDate(x.date)}</span>
                    <span className="history-body">
                      {st && <span className={`tag att-tag-${st}`}>{STATUS_TEXT[st]}</span>}
                      {n?.memorized && <span>حفظ: {rangeText(n.memorized)}</span>}
                      {n?.reviewed && <span>مراجعة: {rangeText(n.reviewed)}</span>}
                      {n?.rating && <span>{RATING_TEXT[n.rating]}</span>}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

/** Send the student a link to two games built from their latest passages and mistakes. */
function GamesCard({ name, plan, phone }: { name: string; plan: ReturnType<typeof planFor>; phone: string | null }) {
  if (!plan) return null
  const link = `${window.location.origin}/play#${encodePlan(plan)}`
  const message = `السلام عليكم، دي ألعاب على حفظ ${plan.n} (كمّل الآية ورتّب الكلمات). يلعبها من اللينك ده ويبعتلي النتيجة:
${link}`
  return (
    <section className="lesson-section card" aria-label="ألعاب للطالب">
      <h2 className="lesson-section-title">ألعاب لـ{name}</h2>
      <p className="field-hint">
        من {plan.p.map(([su, f, t]) => `${surahName(su)} ${toArabicDigits(f)}–${toArabicDigits(t)}`).join('، ')}
        {plan.m.length > 0 && `، والآيات اللي بيغلط فيها بتتكرر أكتر`}.
      </p>
      <div className="profile-actions">
        <a className="btn btn-primary btn-wa" href={`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          ابعت اللعبة واتساب
        </a>
        <a className="btn btn-quiet" href={link} target="_blank" rel="noreferrer">
          جرّبها هنا
        </a>
      </div>
    </section>
  )
}
