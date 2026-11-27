import type { AttendanceStatus } from './attendance'
import { HOMEWORK_TEXT, MISTAKE_TEXT, RATING_TEXT, type LessonNote } from './notes'
import { ayahsInRange, rangeText, surahName } from './quran'

const AR = '٠١٢٣٤٥٦٧٨٩'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)])
const ayat = (n: number) => `${ar(n)} ${n === 1 ? 'آية' : n === 2 ? 'آيتين' : n <= 10 ? 'آيات' : 'آية'}`

/** WhatsApp message to a parent about one lesson. Written in the teacher's name, gender-neutral. */
export function parentMessage(input: {
  name: string
  dateText: string
  status: AttendanceStatus
  note?: LessonNote
  /** The text of a marked word (from the mushaf), when the Quran text is loaded. */
  wordOf?: (s: number, a: number, w: number) => string | undefined
}): string {
  const { name, dateText, status, note, wordOf } = input
  const head = ['السلام عليكم ورحمة الله وبركاته', `تقرير حصة ${name}، ${dateText}`, '']

  if (status === 'a') {
    return [...head, `افتقدنا ${name} في حصة اليوم، ونرجو الانتظام في الحصص القادمة بإذن الله.`].join('\n')
  }
  if (status === 'e') {
    return [...head, `تم تسجيل اعتذار ${name} عن حصة اليوم، وننتظره في الحصة القادمة بإذن الله.`].join('\n')
  }

  const lines = ['✅ الحضور: حضر']
  if (note?.memorized) lines.push(`📖 الحفظ الجديد: ${rangeText(note.memorized)} (${ayat(ayahsInRange(note.memorized))})`)
  if (note?.reviewed) lines.push(`🔁 المراجعة: ${rangeText(note.reviewed)}`)
  if (note?.rating) lines.push(`⭐ التقييم: ${RATING_TEXT[note.rating]}`)
  if (note?.homeworkStatus) lines.push(`📝 الواجب السابق: ${HOMEWORK_TEXT[note.homeworkStatus]}`)
  if (note?.mistakes?.length) {
    const where = note.mistakes
      .map((m) => {
        const word = m.w !== undefined ? wordOf?.(m.s, m.a, m.w) : undefined
        return `${surahName(m.s)} ${ar(m.a)}${word ? `: «${word}»` : ''} (${MISTAKE_TEXT[m.type]})`
      })
      .join('، ')
    lines.push(`⚠️ مواضع تحتاج تركيز: ${where}`)
  }
  if (note?.homework) lines.push(`🏠 الواجب للحصة الجاية: ${note.homework}`)
  if (note?.note) lines.push(`💬 ملاحظة: ${note.note}`)

  return [...head, ...lines, '', `بارك الله في ${name} وزاده حرصًا 🌿`].join('\n')
}
