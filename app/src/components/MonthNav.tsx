import { addMonths, monthLabel } from '../domain/schedule'

/** «› نوفمبر ٢٠٢٦ ‹» with no going past the current month. */
export function MonthNav({ month, max, onChange }: { month: string; max: string; onChange: (m: string) => void }) {
  return (
    <div className="month-nav report-month">
      <button type="button" className="icon-btn" aria-label="الشهر السابق" onClick={() => onChange(addMonths(month, -1))}>
        ›
      </button>
      <h2 className="month-title">{monthLabel(month)}</h2>
      <button type="button" className="icon-btn" aria-label="الشهر التالي" onClick={() => onChange(addMonths(month, 1))} disabled={month >= max}>
        ‹
      </button>
    </div>
  )
}
