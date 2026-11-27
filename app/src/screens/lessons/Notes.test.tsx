import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../domain/attendance'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 }

const group: Group = {
  id: 'g1',
  studentIds: ['s1', 's2'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '09:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
}

const FRI = '2026-11-27'
const NOW = new Date(2026, 10, 27, 12, 0)

const today: Session = {
  id: `g1_${FRI}`,
  groupId: 'g1',
  date: FRI,
  time: '09:00',
  kind: 'regular',
  attendance: { s1: { status: 'p', billable: true }, s2: { status: 'a', billable: true } },
  updatedAt: 1,
}

const lastWeek: Session = {
  id: 'g1_2026-11-20',
  groupId: 'g1',
  date: '2026-11-20',
  time: '09:00',
  kind: 'regular',
  attendance: { s1: { status: 'p', billable: true } },
  notes: { s1: { memorized: { from: { s: 78, a: 1 }, to: { s: 78, a: 10 } }, homework: 'مراجعة النبأ ١–١٠' } },
  updatedAt: 1,
}

const seed = { students: [yusuf, omar], groups: [group], sessions: [lastWeek, today] }

describe('Lesson notes', () => {
  it('shows a notes card only for students who attended', () => {
    renderApp(`/lessons/g1/${FRI}`, seed, { now: NOW })
    expect(screen.getByRole('region', { name: 'ملاحظات يوسف' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'ملاحظات عمر' })).not.toBeInTheDocument()
  })

  it('starts the new memorisation right after where the student stopped', () => {
    renderApp(`/lessons/g1/${FRI}`, seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'ملاحظات يوسف' })
    const mem = within(card).getByRole('group', { name: 'حفظ جديد' })
    expect(within(mem).getByLabelText('السورة')).toHaveValue('78')
    expect(within(mem).getByLabelText('من آية')).toHaveValue(11)
  })

  it('saves memorisation, rating, the previous homework check and new homework', async () => {
    const { repos } = renderApp(`/lessons/g1/${FRI}`, seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'ملاحظات يوسف' })

    expect(card).toHaveTextContent('الواجب السابق: مراجعة النبأ ١–١٠')
    await userEvent.click(within(card).getByRole('radio', { name: 'جزء منه' }))

    const mem = within(card).getByRole('group', { name: 'حفظ جديد' })
    await userEvent.type(within(mem).getByLabelText('إلى آية'), '20')
    await userEvent.click(within(card).getByRole('radio', { name: 'جيد جدًا' }))
    await userEvent.type(within(card).getByLabelText('الواجب للحصة الجاية'), 'حفظ النبأ ٢١–٣٠')
    await userEvent.click(within(card).getByRole('button', { name: 'حفظ الملاحظات' }))

    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.notes?.s1).toEqual({
      memorized: { from: { s: 78, a: 11 }, to: { s: 78, a: 20 } },
      rating: 'very_good',
      homework: 'حفظ النبأ ٢١–٣٠',
      homeworkStatus: 'partial',
    })
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ الملاحظات')
    // Attendance is untouched.
    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.attendance.s2.status).toBe('a')
  })

  it('adds a review range across surahs', async () => {
    const { repos } = renderApp(`/lessons/g1/${FRI}`, seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'ملاحظات يوسف' })
    await userEvent.click(within(card).getByRole('button', { name: 'إضافة مراجعة' }))
    const rev = within(card).getByRole('group', { name: 'مراجعة' })
    await userEvent.selectOptions(within(rev).getByLabelText('السورة'), '78')
    await userEvent.clear(within(rev).getByLabelText('من آية'))
    await userEvent.type(within(rev).getByLabelText('من آية'), '30')
    await userEvent.click(within(rev).getByRole('button', { name: 'لحد سورة تانية' }))
    await userEvent.selectOptions(within(rev).getByLabelText('لحد سورة'), '79')
    await userEvent.type(within(rev).getByLabelText('إلى آية'), '5')
    await userEvent.click(within(card).getByRole('button', { name: 'حفظ الملاحظات' }))
    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.notes?.s1.reviewed).toEqual({
      from: { s: 78, a: 30 },
      to: { s: 79, a: 5 },
    })
  })

  it('explains an impossible range instead of saving it', async () => {
    const { repos } = renderApp(`/lessons/g1/${FRI}`, seed, { now: NOW })
    const card = screen.getByRole('region', { name: 'ملاحظات يوسف' })
    const mem = within(card).getByRole('group', { name: 'حفظ جديد' })
    await userEvent.type(within(mem).getByLabelText('إلى آية'), '99')
    await userEvent.click(within(card).getByRole('button', { name: 'حفظ الملاحظات' }))
    expect(within(card).getByRole('alert')).toHaveTextContent('النبأ فيها ٤٠ آية')
    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.notes).toBeUndefined()
  })
})

describe('Mistakes', () => {
  it('adds a mistake and marks an ayah that went wrong before as repeated', async () => {
    const earlier: Session = {
      ...lastWeek,
      notes: { s1: { ...lastWeek.notes!.s1, mistakes: [{ s: 78, a: 12, type: 'hifz' }] } },
    }
    const { repos } = renderApp(`/lessons/g1/${FRI}`, { ...seed, sessions: [earlier, today] }, { now: NOW })
    const card = screen.getByRole('region', { name: 'ملاحظات يوسف' })
    const add = within(card).getByRole('group', { name: 'إضافة خطأ' })
    await userEvent.selectOptions(within(add).getByLabelText('سورة الخطأ'), '78')
    await userEvent.type(within(add).getByLabelText('آية الخطأ'), '12')
    await userEvent.click(within(add).getByRole('radio', { name: 'تجويد' }))
    await userEvent.click(within(add).getByRole('button', { name: 'إضافة' }))

    const list = within(card).getByRole('list', { name: 'أخطاء الحصة' })
    expect(list).toHaveTextContent('النبأ ١٢')
    expect(list).toHaveTextContent('تجويد')
    expect(list).toHaveTextContent('متكررة')

    await userEvent.click(within(card).getByRole('button', { name: 'حفظ الملاحظات' }))
    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.notes?.s1.mistakes).toEqual([{ s: 78, a: 12, type: 'tajweed' }])
  })
})

describe('Parent message', () => {
  const withPhone = { ...seed, students: [{ ...yusuf, guardianPhone: '01012345678' }, omar] }

  it('prepares a WhatsApp message from the saved notes and marks it sent', async () => {
    const noted: Session = { ...today, notes: { s1: { rating: 'excellent', homework: 'حفظ النبأ ١١–٢٠' } } }
    const { repos } = renderApp(`/lessons/g1/${FRI}`, { ...withPhone, sessions: [lastWeek, noted] }, { now: NOW })
    const box = screen.getByRole('region', { name: 'رسالة ولي أمر يوسف' })
    const text = within(box).getByLabelText('نص الرسالة') as HTMLTextAreaElement
    expect(text.value).toContain('⭐ التقييم: ممتاز')
    expect(text.value).toContain('🏠 الواجب للحصة الجاية: حفظ النبأ ١١–٢٠')

    const link = within(box).getByRole('link', { name: 'إرسال على واتساب' })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/201012345678\?text=/)
    await userEvent.click(link)
    expect(repos.sessions.all().find((s) => s.id === `g1_${FRI}`)?.sent?.s1).toBeTypeOf('number')
    expect(box).toHaveTextContent('اتبعت')
  })

  it('lets the teacher edit the text before sending', async () => {
    renderApp(`/lessons/g1/${FRI}`, withPhone, { now: NOW })
    const box = screen.getByRole('region', { name: 'رسالة ولي أمر يوسف' })
    const text = within(box).getByLabelText('نص الرسالة')
    await userEvent.clear(text)
    await userEvent.type(text, 'رسالة خاصة')
    expect(decodeURIComponent(within(box).getByRole('link', { name: 'إرسال على واتساب' }).getAttribute('href')!)).toContain('رسالة خاصة')
  })

  it('also offers a message for an absent student', () => {
    renderApp(`/lessons/g1/${FRI}`, withPhone, { now: NOW })
    const box = screen.getByRole('region', { name: 'رسالة ولي أمر عمر' })
    expect((within(box).getByLabelText('نص الرسالة') as HTMLTextAreaElement).value).toContain('افتقدنا عمر')
  })
})
