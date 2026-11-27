import { useData, useGroups, useProfile } from '../../data/data'
import { freeTimeText, intervalText, weekPlan, type Interval } from '../../domain/freeTime'
import { WEEKDAY_NAMES, time12 } from '../../domain/schedule'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'

const DEFAULT_WORK = { from: '14:00', to: '23:00' }

const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const hoursText = (min: number) => {
  const h = Math.round((min / 60) * 10) / 10
  return `${toArabicDigits(h)} ساعة`
}

/** Weekly load and free times inside working hours, ready to send to an academy. */
export function WeekSchedule() {
  const { repos, notify } = useData()
  const { today } = useClock()
  const { items: groups } = useGroups()
  const { profile } = useProfile()
  const work = profile.workHours ?? DEFAULT_WORK
  const plan = weekPlan(groups, today, work)
  const text = freeTimeText(plan)
  const start = minutesOf(work.from)
  const end = work.to === '00:00' ? 1440 : minutesOf(work.to)
  const span = Math.max(60, end - start)
  const totalLessons = plan.reduce((n, d) => n + d.lessons, 0)
  const totalMinutes = plan.reduce((n, d) => n + d.minutes, 0)
  const pos = (i: Interval) => {
    const from = Math.max(i.from, start)
    const to = Math.min(i.to, end)
    return { insetInlineStart: `${((from - start) / span) * 100}%`, width: `${(Math.max(0, to - from) / span) * 100}%` }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      notify('اتنسخت مواعيدك الفاضية')
    } catch {
      notify('مقدرتش أنسخ. ابعتها بواتساب من الزرار التاني.')
    }
  }

  return (
    <section aria-label="الجدول الأسبوعي">
      <div className="card week-head">
        <div className="week-totals">
          <span>
            <b>{toArabicDigits(totalLessons)}</b> حصة في الأسبوع
          </span>
          <span>
            <b>{hoursText(totalMinutes)}</b> شغل
          </span>
        </div>
        <div className="form-row">
          <label className="field">
            <span>بداية الشغل</span>
            <input type="time" value={work.from} onChange={(e) => e.target.value && repos.profile.patch({ workHours: { ...work, from: e.target.value } })} />
          </label>
          <label className="field">
            <span>نهاية الشغل</span>
            <input type="time" value={work.to} onChange={(e) => e.target.value && repos.profile.patch({ workHours: { ...work, to: e.target.value } })} />
          </label>
        </div>
      </div>

      <ul className="week-days" aria-label="أيام الأسبوع">
        {plan.map((d) => (
          <li key={d.weekday} className="week-row">
            <div className="week-row-head">
              <b>{WEEKDAY_NAMES[d.weekday]}</b>
              <span className="field-hint">
                {d.lessons ? `${toArabicDigits(d.lessons)} حصة، ${hoursText(d.minutes)}` : 'مفيش حصص'}
              </span>
            </div>
            <div className="week-bar" aria-hidden="true">
              {d.free.map((f) => (
                <span key={`f${f.from}`} className="seg seg-free" style={pos(f)} />
              ))}
              {d.busy.map((b) => (
                <span key={`b${b.from}`} className="seg seg-busy" style={pos(b)} />
              ))}
            </div>
            <div className="week-scale" aria-hidden="true">
              <span>{time12(work.from)}</span>
              <span>{time12(work.to)}</span>
            </div>
            <p className="week-free">
              {d.free.length ? (
                <>
                  <span className="week-free-label">فاضي:</span> {d.free.map(intervalText).join('، ')}
                </>
              ) : (
                <span className="week-full">مفيش وقت فاضي في ساعات شغلك</span>
              )}
            </p>
          </li>
        ))}
      </ul>

      <div className="form-actions week-actions">
        <button type="button" className="btn btn-primary" onClick={() => void copy()}>
          نسخ مواعيدي الفاضية
        </button>
        <a className="btn btn-quiet btn-wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          إرسال بواتساب
        </a>
      </div>
    </section>
  )
}
