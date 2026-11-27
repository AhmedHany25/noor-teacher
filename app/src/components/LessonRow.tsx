import { Link } from 'react-router'
import { useData } from '../data/data'
import {
  STATUS_TEXT,
  lessonStatus,
  quickRecord,
  sessionId,
  type AttendanceStatus,
  type Session,
} from '../domain/attendance'
import { time12, type Group, type Occurrence } from '../domain/schedule'
import { toArabicDigits } from '../lib/format'
import { Avatar } from './Avatar'

const KIND_LABELS = { regular: '', makeup: 'تعويض', trial: 'تجريبية' } as const
const STATUSES: AttendanceStatus[] = ['p', 'a', 'e']
const ICONS: Record<AttendanceStatus, string> = { p: '✓', a: '✕', e: '!' }

type Props = {
  o: Occurrence
  group: Group
  title: string
  /** Name used for the avatar (the first student). */
  avatarName?: string
  session?: Session
  isNext?: boolean
  /** False for days still to come: attendance cannot be recorded yet. */
  canRecord?: boolean
  localTimes?: string[]
}

export function LessonRow({ o, group, title, avatarName, session, isNext, canRecord = true, localTimes = [] }: Props) {
  const { repos } = useData()
  const status = lessonStatus(session)
  const href = `/lessons/${o.groupId}/${o.date}`
  const classes = ['lesson', isNext && 'is-next', o.cancelledBy && 'is-cancelled', status && 'is-recorded']
    .filter(Boolean)
    .join(' ')

  function record(s: AttendanceStatus) {
    repos.sessions.put(sessionId(o.groupId, o.date), quickRecord(o, group, s, session, Date.now()))
  }

  return (
    <li className={classes}>
      <div className="lesson-top">
        <Avatar name={avatarName ?? title} />
        <Link to={href} className="lesson-main">
          <span className="lesson-title">{title}</span>
          <span className="lesson-meta">
            <span>{toArabicDigits(o.durationMin)} دقيقة</span>
            {localTimes.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </Link>
        <span className="lesson-time">{time12(o.time)}</span>
      </div>

      {(isNext || KIND_LABELS[o.kind] || o.cancelledBy || o.movedFrom) && (
        <span className="lesson-tags">
          {isNext && <span className="tag tag-next">الحصة الجاية</span>}
          {KIND_LABELS[o.kind] && <span className="tag">{KIND_LABELS[o.kind]}</span>}
          {o.cancelledBy && <span className="tag tag-muted">ملغاة</span>}
          {o.movedFrom && <span className="tag">منقولة</span>}
        </span>
      )}

      {!o.cancelledBy &&
        canRecord &&
        (group.studentIds.length === 1 ? (
          <span className="att" role="group" aria-label={`حضور ${title}`}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`att-btn att-${s}`}
                aria-pressed={status === s}
                aria-label={`${title}: ${STATUS_TEXT[s]}`}
                onClick={() => record(s)}
              >
                <span aria-hidden="true">{ICONS[s]}</span> {STATUS_TEXT[s]}
              </button>
            ))}
          </span>
        ) : (
          <span className="att">
            <Link to={href} className="btn btn-quiet att-link">
              {status ? 'تعديل الحضور' : 'سجّل الحضور'}
            </Link>
          </span>
        ))}
    </li>
  )
}
