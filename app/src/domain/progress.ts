import type { AttendanceStatus, Session } from './attendance'
import { RATING_TEXT, repeatedMistakes, type Rating } from './notes'
import { ayahsInRange, rangeText, surahName, type Position, type Range } from './quran'

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])

export type MonthSummary = {
  attendance: Record<AttendanceStatus, number>
  /** Share of recorded lessons attended, 0–100, or undefined with no recorded lessons. */
  attendanceRate?: number
  ayat: number
  /** From the first new memorisation of the month to the last. */
  covered?: Range
  reviews: number
  topRating?: Rating
}

export type StudentProgress = {
  totalAyat: number
  lastPosition?: Position
  month: MonthSummary
  repeated: { s: number; a: number; count: number }[]
  /** This student's lessons, newest first. */
  recent: Session[]
}

function summarizeMonth(sessions: Session[], studentId: string): MonthSummary {
  const attendance: Record<AttendanceStatus, number> = { p: 0, a: 0, e: 0 }
  let ayat = 0
  let reviews = 0
  const ratings = new Map<Rating, number>()
  const ranges: Range[] = []
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const st = s.attendance[studentId]?.status
    if (st) attendance[st]++
    const n = s.notes?.[studentId]
    if (!n) continue
    if (n.memorized) {
      ayat += ayahsInRange(n.memorized)
      ranges.push(n.memorized)
    }
    if (n.reviewed) reviews++
    if (n.rating) ratings.set(n.rating, (ratings.get(n.rating) ?? 0) + 1)
  }
  const recorded = attendance.p + attendance.a + attendance.e
  const topRating = [...ratings].sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    attendance,
    attendanceRate: recorded ? Math.round((attendance.p / recorded) * 100) : undefined,
    ayat,
    covered: ranges.length ? { from: ranges[0].from, to: ranges.at(-1)!.to } : undefined,
    reviews,
    topRating,
  }
}

/** Everything the student file shows, for a given month ("YYYY-MM"). */
export function studentProgress(sessions: Session[], studentId: string, month: string): StudentProgress {
  const mine = sessions.filter((s) => s.attendance[studentId] || s.notes?.[studentId])
  const memorized = [...mine]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => s.notes?.[studentId]?.memorized)
    .filter((r): r is Range => !!r)
  return {
    totalAyat: memorized.reduce((n, r) => n + ayahsInRange(r), 0),
    lastPosition: memorized.at(-1)?.to,
    month: summarizeMonth(mine.filter((s) => s.date.startsWith(month)), studentId),
    repeated: repeatedMistakes(mine, studentId),
    recent: [...mine].sort((a, b) => b.date.localeCompare(a.date)),
  }
}

/** Monthly WhatsApp report for a parent. */
export function monthlyReport(input: { name: string; monthText: string; summary: MonthSummary; repeated: { s: number; a: number }[] }): string {
  const { name, monthText, summary: m, repeated } = input
  const recorded = m.attendance.p + m.attendance.a + m.attendance.e
  const lines = [
    'السلام عليكم ورحمة الله وبركاته',
    `التقرير الشهري لـ${name}، ${monthText}`,
    '',
    recorded
      ? `✅ الحضور: ${ar(m.attendance.p)} من ${ar(recorded)} ${recorded >= 3 && recorded <= 10 ? 'حصص' : 'حصة'} (${ar(m.attendanceRate ?? 0)}٪)`
      : '✅ الحضور: لا توجد حصص مسجلة هذا الشهر',
  ]
  if (m.ayat) lines.push(`📖 الحفظ الجديد: ${ar(m.ayat)} آية${m.covered ? ` (${rangeText(m.covered)})` : ''}`)
  if (m.reviews) lines.push(`🔁 المراجعة: ${ar(m.reviews)} ${m.reviews === 1 ? 'مرة' : m.reviews <= 10 ? 'مرات' : 'مرة'}`)
  if (m.topRating) lines.push(`⭐ أغلب التقييمات: ${RATING_TEXT[m.topRating]}`)
  if (repeated.length) lines.push(`⚠️ مواضع تحتاج مراجعة: ${repeated.slice(0, 4).map((r) => `${surahName(r.s)} ${ar(r.a)}`).join('، ')}`)
  lines.push('', `بارك الله في ${name} وجزاكم خيرًا على المتابعة 🌿`)
  return lines.join('\n')
}

