import { describe, expect, it } from 'vitest'
import type { Session } from './attendance'
import { parentMessage } from './message'
import { repeatedMistakes } from './notes'

describe('parentMessage', () => {
  it('names the marked word when it is known', () => {
    const text = parentMessage({
      name: 'يوسف',
      dateText: 'اليوم',
      status: 'p',
      note: { mistakes: [{ s: 78, a: 1, w: 1, type: 'hifz' }, { s: 78, a: 3, type: 'tajweed' }] },
      wordOf: (s, a, w) => (s === 78 && a === 1 && w === 1 ? 'يَتَسَآءَلُونَ' : undefined),
    })
    expect(text).toContain('⚠️ مواضع تحتاج تركيز: النبأ ١: «يَتَسَآءَلُونَ» (حفظ)، النبأ ٣ (تجويد)')
  })

  it('summarises a lesson the student attended', () => {
    const text = parentMessage({
      name: 'يوسف',
      dateText: 'الجمعة، ٢٧ نوفمبر',
      status: 'p',
      note: {
        memorized: { from: { s: 78, a: 11 }, to: { s: 78, a: 20 } },
        reviewed: { from: { s: 114, a: 1 }, to: { s: 113, a: 5 } },
        rating: 'very_good',
        homeworkStatus: 'partial',
        mistakes: [{ s: 78, a: 12, type: 'tajweed' }],
        homework: 'حفظ النبأ ٢١–٣٠',
        note: 'تحسن واضح في المخارج',
      },
    })
    expect(text.split('\n')).toEqual([
      'السلام عليكم ورحمة الله وبركاته',
      'تقرير حصة يوسف، الجمعة، ٢٧ نوفمبر',
      '',
      '✅ الحضور: حضر',
      '📖 الحفظ الجديد: النبأ ١١–٢٠ (١٠ آيات)',
      '🔁 المراجعة: الناس ١ – الفلق ٥',
      '⭐ التقييم: جيد جدًا',
      '📝 الواجب السابق: جزء منه',
      '⚠️ مواضع تحتاج تركيز: النبأ ١٢ (تجويد)',
      '🏠 الواجب للحصة الجاية: حفظ النبأ ٢١–٣٠',
      '💬 ملاحظة: تحسن واضح في المخارج',
      '',
      'بارك الله في يوسف وزاده حرصًا 🌿',
    ])
  })

  it('keeps it short when nothing was noted', () => {
    expect(parentMessage({ name: 'عمر', dateText: 'السبت', status: 'p' })).toContain('✅ الحضور: حضر')
  })

  it('writes a kind note for an absence or an excuse', () => {
    expect(parentMessage({ name: 'عمر', dateText: 'السبت', status: 'a' })).toContain('افتقدنا عمر في حصة اليوم')
    expect(parentMessage({ name: 'عمر', dateText: 'السبت', status: 'e' })).toContain('تم تسجيل اعتذار عمر')
  })
})

describe('repeatedMistakes', () => {
  const ses = (date: string, mistakes: { s: number; a: number }[]): Session => ({
    id: date,
    groupId: 'g',
    date,
    time: '09:00',
    kind: 'regular',
    attendance: { s1: { status: 'p', billable: true } },
    notes: { s1: { mistakes: mistakes.map((m) => ({ ...m, type: 'hifz' as const })) } },
    updatedAt: 1,
  })

  it('lists ayahs that were mistakes in two or more lessons, most frequent first', () => {
    const sessions = [ses('1', [{ s: 78, a: 12 }, { s: 78, a: 5 }]), ses('2', [{ s: 78, a: 12 }]), ses('3', [{ s: 78, a: 12 }, { s: 78, a: 5 }]), ses('4', [{ s: 1, a: 2 }])]
    expect(repeatedMistakes(sessions, 's1')).toEqual([
      { s: 78, a: 12, count: 3 },
      { s: 78, a: 5, count: 2 },
    ])
  })
})
