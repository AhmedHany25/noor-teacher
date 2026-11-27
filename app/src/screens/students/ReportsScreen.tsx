import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { PageHeader } from '../../components/PageHeader'
import { useData, useSessions, useStudents } from '../../data/data'
import { DEFAULT_TIME_ZONE } from '../../domain/countries'
import { monthlyReport, studentProgress } from '../../domain/progress'
import { addMonths, monthLabel } from '../../domain/schedule'
import { whatsappNumber, type Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'
import type { Session } from '../../domain/attendance'

/** Route: /reports — one monthly report per active student, sent one after another. */
export function ReportsScreen() {
  const { today } = useClock()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const { items: students, loading } = useStudents()
  const { items: sessions, loading: l2 } = useSessions()
  if (loading || l2) return null

  const active = students.filter((s) => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  const sent = active.filter((s) => s.reportsSent?.[month]).length

  return (
    <>
      <PageHeader
        title="التقارير الشهرية"
        subtitle={active.length ? `اتبعت ${toArabicDigits(sent)} من ${toArabicDigits(active.length)}` : undefined}
      />

      <div className="month-nav report-month">
        <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => setMonth(addMonths(month, -1))}>
          ›
        </button>
        <h2 className="month-title">{monthLabel(month)}</h2>
        <button type="button" className="icon-btn" aria-label="الشهر التالي" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= thisMonth}>
          ‹
        </button>
      </div>

      {active.length === 0 ? (
        <section className="empty card">
          <p>مفيش طلاب نشطين.</p>
        </section>
      ) : (
        active.map((s) => <ReportCard key={`${s.id}-${month}`} student={s} month={month} sessions={sessions} />)
      )}
    </>
  )
}

function ReportCard({ student, month, sessions }: { student: Student; month: string; sessions: Session[] }) {
  const { repos } = useData()
  const p = studentProgress(sessions, student.id, month)
  const generated = monthlyReport({ name: student.name, monthText: monthLabel(month), summary: p.month, repeated: p.repeated })
  const [custom, setCustom] = useState<string | null>(null)
  const text = custom ?? generated
  const phone = student.guardianPhone ? whatsappNumber(student.guardianPhone, student.timeZone, DEFAULT_TIME_ZONE) : null
  const sentAt = student.reportsSent?.[month]

  function markSent() {
    repos.students.patch(student.id, { reportsSent: { ...student.reportsSent, [month]: Date.now() } })
  }

  return (
    <section className={sentAt ? 'payer report is-sent' : 'payer report'} aria-label={`تقرير ${student.name}`}>
      <header className="payer-head">
        <Avatar name={student.name} />
        <div className="payer-id">
          <h3 className="payer-name">{student.name}</h3>
          <span className="payer-kind">
            {p.month.attendanceRate === undefined ? 'مفيش حصص' : `حضور ${toArabicDigits(p.month.attendanceRate)}٪`}
            {p.month.ayat ? `، ${toArabicDigits(p.month.ayat)} آية` : ''}
          </span>
        </div>
        {sentAt && <span className="tag tag-sent">اتبعت ✓</span>}
      </header>

      <details className="report-details">
        <summary>عرض وتعديل التقرير</summary>
        <label className="sr-only" htmlFor={`rep-${student.id}`}>
          نص التقرير
        </label>
        <textarea id={`rep-${student.id}`} className="message-text" rows={9} value={text} onChange={(e) => setCustom(e.target.value)} />
      </details>

      <div className="payer-actions">
        <a
          href={`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-wa-send"
          onClick={markSent}
        >
          إرسال على واتساب
        </a>
        {!phone && <span className="field-hint">مفيش رقم لولي الأمر</span>}
      </div>
    </section>
  )
}
