import { useAcademies, useData, useGroups, useProfile, useReminderMarks, useStudents } from '../data/data'
import { DEFAULT_TIME_ZONE } from '../domain/countries'
import { time12 } from '../domain/schedule'
import { studentReminderMessage, studentRemindersFor } from '../domain/studentReminders'
import { whatsappNumber } from '../domain/student'
import { useClock } from '../lib/clock'
import { toArabicDigits } from '../lib/format'
import { Avatar } from './Avatar'

/** Today's reminders to families (academies that require them), each one tap to WhatsApp. */
export function StudentRemindersCard() {
  const { repos } = useData()
  const { today, nowTime, timeZone } = useClock()
  const { items: groups } = useGroups()
  const { items: students } = useStudents()
  const { items: academies } = useAcademies()
  const { items: marks } = useReminderMarks()
  const { profile } = useProfile()

  const reminders = studentRemindersFor({
    today,
    groups,
    students,
    academies,
    privateHours: profile.notify?.privateRemindHours ?? 0,
  }).filter((r) => r.date > today || r.time > nowTime) // drop lessons that already started
  if (!reminders.length) return null

  const sentCount = reminders.filter((r) => marks.some((m) => m.id === r.key)).length

  return (
    <section className="lesson-section card reminders" aria-label="تذكيرات الطلاب">
      <div className="message-head">
        <h2 className="lesson-section-title">تذكيرات الطلاب</h2>
        <span className="field-hint">
          اتبعت {toArabicDigits(sentCount)} من {toArabicDigits(reminders.length)}
        </span>
      </div>
      <ul className="reminder-list">
        {reminders.map((r) => {
          const s = students.find((x) => x.id === r.studentId)!
          const sent = marks.some((m) => m.id === r.key)
          const due = r.dueTime <= nowTime
          const phone = s.guardianPhone ? whatsappNumber(s.guardianPhone, s.timeZone, DEFAULT_TIME_ZONE) : null
          const text = studentReminderMessage({ name: s.name, date: r.date, time: r.time, today, teacherTz: timeZone, studentTz: s.timeZone })
          return (
            <li key={r.key} className={sent ? 'reminder is-sent' : due ? 'reminder is-due' : 'reminder'}>
              <Avatar name={s.name} size="sm" />
              <span className="reminder-text">
                <b>{s.name}</b>
                <span>
                  حصة {r.date === today ? '' : 'بكرة '}
                  {time12(r.time)}، {due ? 'وقت التذكير دلوقتي' : `تذكّره الساعة ${time12(r.dueTime)}`}
                </span>
              </span>
              {sent ? (
                <span className="tag tag-sent">اتبعت ✓</span>
              ) : (
                <a
                  className="btn btn-quiet btn-wa"
                  href={`https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`ذكّر ${s.name}`}
                  onClick={() => repos.reminderMarks.put(r.key, { sentAt: Date.now() })}
                >
                  ذكّر
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
