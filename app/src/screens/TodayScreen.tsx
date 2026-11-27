import { useState } from 'react'
import { formatDayName, formatGregorian, formatHijri } from '../lib/format'

export function TodayScreen({ now: fixedNow }: { now?: Date }) {
  const [now] = useState(() => fixedNow ?? new Date())
  return (
    <>
      <header className="today-head">
        <h1 className="today-day">{formatDayName(now)}</h1>
        <p className="today-dates">
          <span>{formatGregorian(now)}</span>
          <span className="hijri">{formatHijri(now)}</span>
        </p>
      </header>
      <section className="empty">
        <h2>لا توجد حصص اليوم</h2>
        <p>بعد إضافة الطلاب والحلقات ستظهر هنا حصص اليوم بالترتيب، وتسجّل الحضور بضغطة واحدة.</p>
      </section>
    </>
  )
}
