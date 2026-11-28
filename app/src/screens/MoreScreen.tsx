import { Link } from 'react-router'
import { CircleIcon, GamesIcon, ReportIcon, SettingsIcon } from '../components/icons'
import { PageHeader } from '../components/PageHeader'

const LINKS = [
  { to: '/groups', label: 'الحلقات', hint: 'مواعيد الحلقات، والجدول الأسبوعي والأوقات الفاضية', icon: <CircleIcon /> },
  { to: '/games', label: 'الألعاب', hint: 'ألعاب الحفظ والمعاني للحصة، ومحتواها', icon: <GamesIcon /> },
  { to: '/reports', label: 'التقارير', hint: 'تقارير أولياء الأمور، وكشوف الأكاديميات، والحضور، وملخصك', icon: <ReportIcon /> },
  { to: '/settings', label: 'الإعدادات', hint: 'الإشعارات، والمظهر، والنسخة الاحتياطية', icon: <SettingsIcon /> },
]

/** Route: /more — the sections that do not fit the phone's bottom bar. */
export function MoreScreen() {
  return (
    <>
      <PageHeader title="المزيد" />
      <ul className="more-links">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="more-link">
              <span className="more-icon">{l.icon}</span>
              <span className="more-text">
                <b>{l.label}</b>
                <span>{l.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
