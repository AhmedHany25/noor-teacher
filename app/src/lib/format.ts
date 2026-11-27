const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Converts Western digits (0-9) to Arabic-Indic digits (٠-٩). */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)])
}

const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' })
const gregorian = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDayName(date: Date): string {
  return dayName.format(date)
}

export function formatGregorian(date: Date): string {
  return toArabicDigits(gregorian.format(date))
}

export function formatHijri(date: Date): string {
  return toArabicDigits(hijri.format(date))
}

/** Western digits from any digits the user typed (Arabic-Indic included); undefined if empty. */
export function parseNumber(v: string): number | undefined {
  const t = v.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.')
  return t ? Number(t) : undefined
}

const longFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}


/** "2026-11-27" → "الجمعة، ٢٧ نوفمبر" (time zone safe). */
export function longDate(iso: string): string {
  return toArabicDigits(longFmt.format(utcDate(iso)))
}
