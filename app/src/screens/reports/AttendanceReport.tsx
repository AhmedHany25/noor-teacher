import { useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { useAcademies, useGroups, useSessions, useStudents } from '../../data/data'
import { attendanceByStudent, attendanceCsv, filterLessons, lessonsInRange, presetRange, type Preset } from '../../domain/attendanceList'
import { useClock } from '../../lib/clock'
import { longDate, toArabicDigits } from '../../lib/format'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'week', label: 'الأسبوع ده' },
  { value: 'month', label: 'الشهر ده' },
  { value: 'custom', label: 'فترة' },
]

/** Route: /reports/attendance — attendance per student for a period, exportable to Excel. */
export function AttendanceReport() {
  const { today, nowTime } = useClock()
  const { items: students, loading } = useStudents()
  const { items: academies } = useAcademies()
  const { items: groups } = useGroups()
  const { items: sessions, loading: l2 } = useSessions()
  const [preset, setPreset] = useState<Preset>('month')
  const [custom, setCustom] = useState({ from: `${today.slice(0, 7)}-01`, to: today })
  const [payer, setPayer] = useState('')
  if (loading || l2) return null

  const range = presetRange(preset, today, custom)
  const list = filterLessons(lessonsInRange(groups, sessions, range.from, range.to, { today, time: nowTime }), groups, students, { payer: payer || undefined })
  const rows = attendanceByStudent(list, groups, students).filter((r) => {
    if (!payer) return true
    const s = students.find((x) => x.id === r.studentId)
    return payer === 'private' ? !s?.academyId : s?.academyId === payer
  })

  function download() {
    const url = URL.createObjectURL(new Blob([attendanceCsv(rows, range.from, range.to)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `حضور ${range.from} ${range.to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <PageHeader title="تقرير الحضور" subtitle={`${longDate(range.from)} إلى ${longDate(range.to)}`} />
      <section className="filters card" aria-label="الفلاتر">
        <div className="chip-row">
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
      </section>

      {rows.length === 0 ? (
        <section className="empty card">
          <p>مفيش حصص في الفترة دي.</p>
        </section>
      ) : (
        <div className="card table-card">
          <table className="report-table" aria-label="حضور الطلاب">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>حضر</th>
                <th>غاب</th>
                <th>اعتذر</th>
                <th>لم تُسجَّل</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td>{r.name}</td>
                  <td>{toArabicDigits(r.p)}</td>
                  <td>{toArabicDigits(r.a)}</td>
                  <td>{toArabicDigits(r.e)}</td>
                  <td>{toArabicDigits(r.none)}</td>
                  <td>{r.rate === undefined ? '—' : `${toArabicDigits(r.rate)}٪`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-actions">
            <button type="button" className="btn btn-quiet" onClick={download}>
              تحميل Excel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
