import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/PageHeader'
import { useData, useNotifications, useProfile } from '../data/data'
import type { NotificationEntry } from '../data/repos'
import { useClock } from '../lib/clock'
import { agoText } from '../lib/format'

/** Route: /notifications — every reminder sent in the last 30 days. Opening it marks them read. */
export function NotificationsScreen() {
  const { items, loading } = useNotifications()
  const { profile, loading: loadingProfile } = useProfile()

  return (
    <>
      <PageHeader title="الإشعارات" subtitle="آخر ٣٠ يوم" />
      {loading || loadingProfile ? null : items.length === 0 ? (
        <section className="empty card">
          <h2>مفيش إشعارات لسه</h2>
          <p>
            التذكيرات اللي بتوصلك قبل الحصص وآخر اليوم هتتسجل هنا. فعّلها من <Link to="/settings">الإعدادات</Link>.
          </p>
        </section>
      ) : (
        <NotificationList items={items} seenAt={profile.notifySeenAt ?? 0} />
      )}
    </>
  )
}

function NotificationList({ items, seenAt }: { items: NotificationEntry[]; seenAt: number }) {
  const { repos } = useData()
  const { now } = useClock()
  // What was unread when the page opened stays highlighted while reading.
  const [seenBefore] = useState(seenAt)
  const newest = items[0]?.at ?? 0

  useEffect(() => {
    if (newest > seenBefore) repos.profile.patch({ notifySeenAt: Date.now() })
  }, [newest, seenBefore, repos])

  return (
    <ul className="notif-list" aria-label="الإشعارات">
      {items.map((n) => (
        <li key={n.id} className={n.at > seenBefore ? 'notif is-new' : 'notif'}>
          <Link to={n.url || '/'} className="notif-link">
            <b className="notif-title">{n.title ?? 'تذكير'}</b>
            {n.body && <span className="notif-body">{n.body}</span>}
            <span className="notif-time">{agoText(n.at, now.getTime())}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
