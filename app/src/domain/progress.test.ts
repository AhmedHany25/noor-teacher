import { describe, expect, it } from 'vitest'
import type { AttendanceStatus, Session } from './attendance'
import type { LessonNote } from './notes'
import { monthlyReport, studentProgress } from './progress'

const ses = (date: string, status: AttendanceStatus, note?: LessonNote): Session => ({
  id: `g_${date}`,
  groupId: 'g',
  date,
  time: '09:00',
  kind: 'regular',
  attendance: { s1: { status, billable: status !== 'e' } },
  notes: note ? { s1: note } : undefined,
  updatedAt: 1,
})

const history = [
  ses('2026-10-30', 'p', { memorized: { from: { s: 114, a: 1 }, to: { s: 114, a: 6 } } }),
  ses('2026-11-06', 'p', { memorized: { from: { s: 78, a: 1 }, to: { s: 78, a: 10 } }, rating: 'good', mistakes: [{ s: 78, a: 7, type: 'hifz' }] }),
  ses('2026-11-13', 'a'),
  ses('2026-11-20', 'p', {
    memorized: { from: { s: 78, a: 11 }, to: { s: 78, a: 20 } },
    reviewed: { from: { s: 78, a: 1 }, to: { s: 78, a: 10 } },
    rating: 'very_good',
    mistakes: [{ s: 78, a: 7, type: 'tajweed' }],
  }),
  ses('2026-11-27', 'p', { rating: 'very_good' }),
]

describe('studentProgress', () => {
  const p = studentProgress(history, 's1', '2026-11')

  it('totals memorisation and knows where the student stopped', () => {
    expect(p.totalAyat).toBe(26)
    expect(p.lastPosition).toEqual({ s: 78, a: 20 })
  })

  it("summarises the month's attendance, memorisation, reviews and ratings", () => {
    expect(p.month).toEqual({
      attendance: { p: 3, a: 1, e: 0 },
      attendanceRate: 75,
      ayat: 20,
      covered: { from: { s: 78, a: 1 }, to: { s: 78, a: 20 } },
      reviews: 1,
      topRating: 'very_good',
    })
  })

  it('lists repeated mistakes and recent lessons newest first', () => {
    expect(p.repeated).toEqual([{ s: 78, a: 7, count: 2 }])
    expect(p.recent.map((s) => s.date)[0]).toBe('2026-11-27')
  })
})

describe('monthlyReport', () => {
  it('writes the monthly message for the parent', () => {
    const p = studentProgress(history, 's1', '2026-11')
    expect(monthlyReport({ name: 'يوسف', monthText: 'نوفمبر ٢٠٢٦', summary: p.month, repeated: p.repeated }).split('\n')).toEqual([
      'السلام عليكم ورحمة الله وبركاته',
      'التقرير الشهري لـيوسف، نوفمبر ٢٠٢٦',
      '',
      '✅ الحضور: ٣ من ٤ حصص (٧٥٪)',
      '📖 الحفظ الجديد: ٢٠ آية (النبأ ١–٢٠)',
      '🔁 المراجعة: ١ مرة',
      '⭐ أغلب التقييمات: جيد جدًا',
      '⚠️ مواضع تحتاج مراجعة: النبأ ٧',
      '',
      'بارك الله في يوسف وجزاكم خيرًا على المتابعة 🌿',
    ])
  })
})
