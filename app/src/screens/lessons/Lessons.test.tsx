import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../domain/attendance'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1 }

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '09:00' }], // Fridays 9 am
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

const FRI = '2026-11-27'
const NOW = new Date(2026, 10, 27, 12, 0) // Friday noon, after the 9 am lesson

describe('Quick attendance on the attendance page', () => {
  it('records attendance for a one-student lesson with one tap', async () => {
    const { repos } = renderApp(`/attendance?date=${FRI}`, { students: [yusuf], groups: [group()] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'يوسف: حضر' }))
    expect(repos.sessions.all()).toMatchObject([
      { id: 'g1_2026-11-27', groupId: 'g1', date: FRI, attendance: { s1: { status: 'p', billable: true } } },
    ])
    expect(screen.getByRole('button', { name: 'يوسف: حضر' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes a recorded status with another tap', async () => {
    const { repos } = renderApp(`/attendance?date=${FRI}`, { students: [yusuf], groups: [group()] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'يوسف: حضر' }))
    await userEvent.click(screen.getByRole('button', { name: 'يوسف: اعتذر' }))
    expect(repos.sessions.all()).toHaveLength(1)
    expect(repos.sessions.all()[0].attendance.s1).toEqual({ status: 'e', billable: false })
  })

  it('sends multi-student lessons to the lesson page instead', () => {
    renderApp(`/attendance?date=${FRI}`, { students: [yusuf, omar], groups: [group({ studentIds: ['s1', 's2'] })] }, { now: NOW })
    expect(screen.getByRole('link', { name: 'سجّل الحضور' })).toHaveAttribute('href', `/lessons/g1/${FRI}`)
  })
})

describe('Lesson page', () => {
  it('records each student separately, with pay choice for an absence and the actual duration', async () => {
    const { repos } = renderApp(
      `/lessons/g1/${FRI}`,
      { students: [yusuf, omar], groups: [group({ studentIds: ['s1', 's2'] })] },
      { now: NOW },
    )
    const yRow = screen.getByRole('group', { name: 'يوسف' })
    const oRow = screen.getByRole('group', { name: 'عمر' })
    await userEvent.click(within(yRow).getByRole('radio', { name: 'حضر' }))
    await userEvent.click(within(oRow).getByRole('radio', { name: 'غاب' }))
    await userEvent.click(within(oRow).getByRole('checkbox', { name: 'تُحتسب في المستحقات' }))
    await userEvent.selectOptions(screen.getByLabelText('المدة الفعلية'), '45')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ الحضور' }))

    expect(repos.sessions.all()[0]).toMatchObject({
      id: `g1_${FRI}`,
      actualDurationMin: 45,
      attendance: { s1: { status: 'p', billable: true }, s2: { status: 'a', billable: false } },
    })
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ الحضور')
  })

  it('needs a status for every student before saving', async () => {
    const { repos } = renderApp(
      `/lessons/g1/${FRI}`,
      { students: [yusuf, omar], groups: [group({ studentIds: ['s1', 's2'] })] },
      { now: NOW },
    )
    await userEvent.click(within(screen.getByRole('group', { name: 'يوسف' })).getByRole('radio', { name: 'حضر' }))
    await userEvent.click(screen.getByRole('button', { name: 'حفظ الحضور' }))
    expect(screen.getByText('حدد الحضور لكل الطلاب.')).toBeInTheDocument()
    expect(repos.sessions.all()).toHaveLength(0)
  })

  it('cancels a lesson by the teacher and can undo it', async () => {
    const { repos } = renderApp(`/lessons/g1/${FRI}`, { students: [yusuf], groups: [group()] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'إلغاء الحصة' }))
    await userEvent.click(screen.getByRole('button', { name: 'ألغيتها أنا' }))
    expect(repos.groups.all()[0].exceptions[FRI]).toEqual({ type: 'cancel', by: 'teacher' })
    expect(screen.getByText(/ألغيتها أنا/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'تراجع عن الإلغاء' }))
    expect(repos.groups.all()[0].exceptions).toEqual({})
  })

  it('moves a lesson to another day', async () => {
    const { repos } = renderApp(`/lessons/g1/${FRI}`, { students: [yusuf], groups: [group()] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'نقل لموعد آخر' }))
    await userEvent.clear(screen.getByLabelText('اليوم الجديد'))
    await userEvent.type(screen.getByLabelText('اليوم الجديد'), '2026-11-28')
    await userEvent.clear(screen.getByLabelText('الوقت الجديد'))
    await userEvent.type(screen.getByLabelText('الوقت الجديد'), '20:00')
    await userEvent.click(screen.getByRole('button', { name: 'نقل' }))
    expect(repos.groups.all()[0].exceptions[FRI]).toEqual({ type: 'move', toDate: '2026-11-28', toTime: '20:00' })
  })

  it('clears a recorded lesson', async () => {
    const recorded: Session = {
      id: `g1_${FRI}`,
      groupId: 'g1',
      date: FRI,
      time: '09:00',
      kind: 'regular',
      attendance: { s1: { status: 'p', billable: true } },
      updatedAt: 1,
    }
    const { repos } = renderApp(
      `/lessons/g1/${FRI}`,
      { students: [yusuf], groups: [group()], sessions: [recorded] },
      { now: NOW },
    )
    await userEvent.click(screen.getByRole('button', { name: 'مسح التسجيل' }))
    expect(repos.sessions.all()).toHaveLength(0)
  })
})

describe('Missed lessons', () => {
  it('counts them on Today and lists them on the attendance page for quick recording', async () => {
    const { repos } = renderApp('/', { students: [yusuf], groups: [group()] }, { now: NOW })
    // Three earlier Fridays this month (6, 13, 20) are unrecorded; today's lesson is on screen already.
    await userEvent.click(screen.getByRole('link', { name: /٣ حصص فاتت من غير تسجيل/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'الحضور والغياب' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /لم تُسجَّل/ })).toHaveAttribute('aria-pressed', 'true')
    const region = screen.getByRole('region', { name: 'الحصص' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(4) // the three plus today's
    await userEvent.click(within(region).getAllByRole('button', { name: 'يوسف: غاب' })[0])
    expect(repos.sessions.all()).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'الحصص' })).getAllByRole('listitem')).toHaveLength(3)
  })

  it('says all caught up when nothing is missing (old /review link still works)', () => {
    renderApp('/review', { students: [yusuf], groups: [group({ startDate: FRI, slots: [{ weekday: 5, time: '18:00' }] })] }, { now: NOW })
    expect(screen.getByText('كل حصص الفترة دي متسجلة.')).toBeInTheDocument()
  })
})

describe('Missed lessons and the current batch', () => {
  it('does not count lessons before the last payment from that payer', () => {
    renderApp(
      '/',
      {
        students: [yusuf],
        groups: [group()],
        payments: [{ id: 'p1', payerKey: 'student:s1', amount: 100, currency: 'جنيه', date: '2026-11-14', resetsCycle: true }],
      },
      { now: NOW },
    )
    expect(screen.getByRole('link', { name: /١ حصص فاتت من غير تسجيل/ })).toBeInTheDocument() // only Nov 20
  })

  it('lets the teacher set where a batch starts from the attendance page', async () => {
    const { repos } = renderApp('/attendance', { students: [yusuf], groups: [group()] }, { now: NOW })
    const input = screen.getByLabelText('بداية دفعة يوسف')
    await userEvent.clear(input)
    await userEvent.type(input, '2026-11-25')
    expect(repos.students.all()[0].trackFrom).toBe('2026-11-25')
  })
})
