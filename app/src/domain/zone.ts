// Time-zone helpers with no UI dependencies (shared by the app and the reminder sender).

function zoneParts(d: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]))
}

/** Calendar date of an instant in a time zone, "YYYY-MM-DD". */
export function dateInZone(d: Date, timeZone: string): string {
  const p = zoneParts(d, timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

/** Wall-clock time of an instant in a time zone, "HH:mm". */
export function timeInZone(d: Date, timeZone: string): string {
  const p = zoneParts(d, timeZone)
  return `${p.hour}:${p.minute}`
}
