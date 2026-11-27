import { Link } from 'react-router'
import { useGroups, useStudents } from '../../data/data'
import { groupTitle, scheduleText } from '../../domain/schedule'
import { toArabicDigits } from '../../lib/format'

export function GroupsScreen() {
  const { items: groups, loading } = useGroups()
  const { items: students, loading: loadingStudents } = useStudents()
  if (loading || loadingStudents) return null

  const active = groups
    .filter((g) => !g.archived)
    .map((g) => ({ g, title: groupTitle(g, students) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'ar'))
  const ended = groups.filter((g) => g.archived).length

  return (
    <>
      <div className="screen-head">
        <h1 className="screen-title">الحلقات</h1>
        {students.length > 0 && (
          <Link to="/groups/new" className="btn btn-primary">
            إضافة حلقة
          </Link>
        )}
      </div>

      {students.length === 0 ? (
        <section className="empty">
          <h2>أضف طلابك أولًا</h2>
          <p>
            الحلقة بتجمع طالب أو أكتر على مواعيد ثابتة كل أسبوع. <Link to="/students/new">إضافة طالب</Link>
          </p>
        </section>
      ) : active.length === 0 ? (
        <section className="empty">
          <h2>أضف أول حلقة</h2>
          <p>اختار الطالب وأيام الحصص ووقت كل يوم، وهتظهر الحصص لوحدها في «اليوم».</p>
        </section>
      ) : (
        <ul className="rows" aria-label="الحلقات">
          {active.map(({ g, title }) => (
            <li key={g.id} className="row">
              <Link to={`/groups/${g.id}`} className="row-main">
                <span className="row-title">{title}</span>
                <span className="row-meta">
                  <span>{scheduleText(g.slots)}</span>
                  <span>{toArabicDigits(g.durationMin)} دقيقة</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {ended > 0 && <p className="section-note">{toArabicDigits(ended)} حلقة منتهية محفوظة في التاريخ.</p>}
    </>
  )
}
