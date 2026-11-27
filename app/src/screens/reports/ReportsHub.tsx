import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'

const REPORTS = [
  { to: '/reports/parents', title: 'التقارير الشهرية لأولياء الأمور', hint: 'رسالة لكل طالب: الحضور والحفظ والمراجعة والتقييم.' },
  { to: '/reports/academies', title: 'كشوف الأكاديميات', hint: 'كشف شهري لكل أكاديمية، واتساب أو Excel.' },
  { to: '/reports/attendance', title: 'تقرير الحضور', hint: 'حضور وغياب كل طالب في فترة تختارها، وتنزيله Excel.' },
  { to: '/reports/summary', title: 'ملخصك الشهري', hint: 'عدد الحصص والساعات، والمستحق والمستلم لكل عملة.' },
]

/** Route: /reports — the kinds of report. */
export function ReportsHub() {
  return (
    <>
      <PageHeader title="التقارير" />
      <ul className="more-links" aria-label="أنواع التقارير">
        {REPORTS.map((r) => (
          <li key={r.to}>
            <Link to={r.to} className="more-link">
              <span className="more-text">
                <b>{r.title}</b>
                <span>{r.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
