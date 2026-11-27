import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useStudents } from '../../data/data'
import { DEFAULT_TIME_ZONE, countryOf } from '../../domain/countries'
import { STATUS_LABELS, filterStudents, whatsappNumber, type StudentStatus } from '../../domain/student'
import { toArabicDigits } from '../../lib/format'

const STATUSES: StudentStatus[] = ['active', 'paused', 'left']

export function StudentsScreen() {
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const [status, setStatus] = useState<StudentStatus>('active')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<StudentStatus, number> = { active: 0, paused: 0, left: 0 }
    students.forEach((s) => c[s.status]++)
    return c
  }, [students])

  const shown = useMemo(() => filterStudents(students, { status, query }), [students, status, query])
  const academyName = (id: string | null) => (id ? (academies.find((a) => a.id === id)?.name ?? 'أكاديمية محذوفة') : 'خصوصي')

  return (
    <>
      <PageHeader
        title="الطلاب"
        subtitle={loading ? undefined : `${toArabicDigits(counts.active)} طالب نشط`}
        action={
          <div className="band-actions">
            <Link to="/reports" className="btn btn-ghost-light">
              التقارير الشهرية
            </Link>
            <Link to="/students/new" className="btn btn-gold">
              إضافة طالب
            </Link>
          </div>
        }
      />

      {loading ? null : students.length === 0 ? (
        <section className="empty">
          <h2>أضف أول طالب</h2>
          <p>سجّل اسم الطالب ورقم ولي أمره وجهة الدفع، وبعدها تقدر تضيفه لحلقة وتسجّل حضوره.</p>
        </section>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="حالة الطالب">
            {STATUSES.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={status === s}
                className="tab"
                onClick={() => setStatus(s)}
              >
                {STATUS_LABELS[s]}
                <span className="tab-count">{toArabicDigits(counts[s])}</span>
              </button>
            ))}
          </div>

          <input
            type="search"
            className="search"
            placeholder="ابحث بالاسم"
            aria-label="ابحث بالاسم"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {shown.length === 0 ? (
            <p className="list-empty">
              {query ? 'لا يوجد طالب بهذا الاسم.' : `لا يوجد طلاب في «${STATUS_LABELS[status]}».`}
            </p>
          ) : (
            <ul className="stu-list" aria-label="قائمة الطلاب">
              {shown.map((s) => {
                const wa = s.guardianPhone ? whatsappNumber(s.guardianPhone, s.timeZone, DEFAULT_TIME_ZONE) : null
                const country = s.timeZone ? countryOf(s.timeZone)?.name : undefined
                return (
                  <li key={s.id} className="stu-row">
                    <Avatar name={s.name} />
                    <Link to={`/students/${s.id}`} className="stu-main">
                      <span className="stu-name">{s.name}</span>
                      <span className="stu-meta">
                        <span>{academyName(s.academyId)}</span>
                        {s.level && <span>{s.level}</span>}
                        {country && <span>{country}</span>}
                      </span>
                    </Link>
                    {wa && (
                      <a
                        className="stu-wa"
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`واتساب ولي أمر ${s.name}`}
                      >
                        <WhatsAppIcon />
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"
      />
    </svg>
  )
}
