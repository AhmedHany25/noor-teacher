import { useState } from 'react'
import { WEEK_ORDER, addDays, addMonths, monthGrid, monthLabel, weekDates, type Weekday } from '../domain/schedule'
import { longDate, toArabicDigits } from '../lib/format'

const SHORT: Record<Weekday, string> = { 6: 'سبت', 0: 'أحد', 1: 'اثنين', 2: 'ثلاثاء', 3: 'أربعاء', 4: 'خميس', 5: 'جمعة' }
const LETTER: Record<Weekday, string> = { 6: 'س', 0: 'ح', 1: 'ن', 2: 'ث', 3: 'ر', 4: 'خ', 5: 'ج' }

const dayNum = (d: string) => toArabicDigits(Number(d.slice(8)))

type Props = {
  selected: string
  today: string
  /** Number of (non-cancelled) lessons on a date. */
  countOn: (date: string) => number
  onSelect: (date: string) => void
}

/** Week strip that unfolds into a month; every day shows its lesson count as dots. */
export function Calendar({ selected, today, countOn, onSelect }: Props) {
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const month = selected.slice(0, 7)

  function shift(step: number) {
    onSelect(mode === 'week' ? addDays(selected, step * 7) : `${addMonths(month, step)}-01`)
  }

  function dayButton(d: string, variant: 'week' | 'month') {
    const n = countOn(d)
    const classes = [
      'cal-day',
      `cal-${variant}`,
      d === today && 'is-today',
      d === selected && 'is-selected',
      variant === 'month' && d.slice(0, 7) !== month && 'is-outside',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <button
        key={d}
        type="button"
        className={classes}
        aria-pressed={d === selected}
        aria-label={`${longDate(d)}: ${n ? `${toArabicDigits(n)} ${n === 1 ? 'حصة' : 'حصص'}` : 'لا حصص'}`}
        onClick={() => {
          onSelect(d)
          if (variant === 'month') setMode('week')
        }}
      >
        {variant === 'week' && <span className="cal-name">{SHORT[WEEK_ORDER[weekDates(selected).indexOf(d)]]}</span>}
        <b className="cal-num">{dayNum(d)}</b>
        <span className="cal-dots" aria-hidden="true">
          {Array.from({ length: Math.min(n, 4) }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      </button>
    )
  }

  return (
    <section className="cal" aria-label="الجدول">
      <div className="cal-head">
        <button type="button" className="icon-btn" aria-label={mode === 'week' ? 'الأسبوع السابق' : 'الشهر السابق'} onClick={() => shift(-1)}>
          ›
        </button>
        <span className="cal-title">{monthLabel(month)}</span>
        <button type="button" className="icon-btn" aria-label={mode === 'week' ? 'الأسبوع التالي' : 'الشهر التالي'} onClick={() => shift(1)}>
          ‹
        </button>
        <span className="cal-spacer" />
        {selected !== today && (
          <button type="button" className="chip" onClick={() => onSelect(today)}>
            النهارده
          </button>
        )}
        <button type="button" className="chip" aria-pressed={mode === 'month'} onClick={() => setMode(mode === 'week' ? 'month' : 'week')}>
          {mode === 'week' ? 'الشهر' : 'الأسبوع'}
        </button>
      </div>

      {mode === 'week' ? (
        <div className="cal-week">{weekDates(selected).map((d) => dayButton(d, 'week'))}</div>
      ) : (
        <div className="cal-month">
          {WEEK_ORDER.map((w) => (
            <span key={w} className="cal-letter" aria-hidden="true">
              {LETTER[w]}
            </span>
          ))}
          {monthGrid(month).map((d) => dayButton(d, 'month'))}
        </div>
      )}
    </section>
  )
}
