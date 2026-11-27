import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Group } from '../../domain/schedule'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const yusuf: Student = { id: 's1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
const omar: Student = { id: 's2', name: 'عمر', academyId: null, status: 'active', createdAt: 1, timeZone: 'Asia/Riyadh' }
const gone: Student = { id: 's3', name: 'سالم', academyId: null, status: 'left', createdAt: 1 }

const group = (over: Partial<Group> = {}): Group => ({
  id: 'g1',
  studentIds: ['s1'],
  startDate: '2026-11-01',
  slots: [{ weekday: 5, time: '17:00' }],
  durationMin: 30,
  pausedMonths: [],
  exceptions: {},
  archived: false,
  ...over,
})

// Friday 2026-11-27, 10:00 in the morning.
const NOW = new Date(2026, 10, 27, 10, 0)

describe('Groups', () => {
  it('asks for students first when there are none', () => {
    renderApp('/groups')
    expect(screen.getByRole('heading', { name: 'أضف طلابك أولًا' })).toBeInTheDocument()
  })

  it('lists groups with their weekly schedule', () => {
    renderApp('/groups', {
      students: [yusuf],
      groups: [group({ slots: [{ weekday: 2, time: '19:00' }, { weekday: 6, time: '09:30' }], durationMin: 45 })],
    })
    const row = within(screen.getByRole('list', { name: 'الحلقات' })).getByRole('listitem')
    expect(row).toHaveTextContent('يوسف')
    expect(row).toHaveTextContent('السبت ٩:٣٠ ص، الثلاثاء ٧:٠٠ م')
    expect(row).toHaveTextContent('٤٥ دقيقة')
  })

  it('filters groups by a day of the week', async () => {
    renderApp('/groups', {
      students: [yusuf, omar],
      groups: [
        group({ id: 'g1', studentIds: ['s1'], slots: [{ weekday: 6, time: '09:30' }] }),
        group({ id: 'g2', studentIds: ['s2'], slots: [{ weekday: 2, time: '19:00' }] }),
      ],
    })
    expect(screen.getByRole('tab', { name: /السبت/ })).toHaveTextContent('١')
    await userEvent.click(screen.getByRole('tab', { name: /السبت/ }))
    const items = within(screen.getByRole('list', { name: 'الحلقات' })).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('يوسف')
    expect(items[0]).toHaveTextContent('٩:٣٠ ص')
    await userEvent.click(screen.getByRole('button', { name: 'عرض الكل' }))
    expect(within(screen.getByRole('list', { name: 'الحلقات' })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('creates a group: pick a student, tick days, set times', async () => {
    const { repos } = renderApp('/groups/new', { students: [yusuf, omar, gone] }, { now: NOW })
    expect(screen.queryByRole('checkbox', { name: 'سالم' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'يوسف' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'السبت' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'الثلاثاء' }))
    const sat = screen.getByLabelText('وقت السبت')
    await userEvent.clear(sat)
    await userEvent.type(sat, '09:30')
    await userEvent.selectOptions(screen.getByLabelText('مدة الحصة'), '45')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    const saved = repos.groups.all()[0]
    expect(saved).toMatchObject({ studentIds: ['s1'], durationMin: 45, startDate: '2026-11-27', archived: false })
    expect(saved.slots).toEqual(
      expect.arrayContaining([
        { weekday: 6, time: '09:30' },
        { weekday: 2, time: expect.stringMatching(/^\d{2}:\d{2}$/) },
      ]),
    )
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ الحلقة')
  })

  it('records lessons already taken in the current batch for each student of a new group', async () => {
    const { repos } = renderApp('/groups/new?student=s1', { students: [yusuf] }, { now: NOW })
    await userEvent.click(screen.getByRole('checkbox', { name: 'السبت' }))
    await userEvent.type(screen.getByLabelText('اتاخد كام حصة في الدفعة الحالية قبل التطبيق؟'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.students.all()[0].openingLessons).toEqual({ count: 5, date: '2026-11-27', minutes: 150 })
  })

  it('opens a new group with a student already chosen from the student page link', async () => {
    renderApp('/groups/new?student=s2', { students: [yusuf, omar] }, { now: NOW })
    expect(screen.getByRole('checkbox', { name: 'عمر' })).toBeChecked()
  })

  it('explains what is missing instead of saving', async () => {
    const { repos } = renderApp('/groups/new', { students: [yusuf] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(screen.getByText('اختر طالبًا واحدًا على الأقل.')).toBeInTheDocument()
    expect(screen.getByText('اختر يومًا واحدًا على الأقل.')).toBeInTheDocument()
    expect(repos.groups.all()).toHaveLength(0)
  })

  it('ends a group from its page', async () => {
    const { repos } = renderApp('/groups/g1', { students: [yusuf], groups: [group()] }, { now: NOW })
    await userEvent.click(screen.getByRole('checkbox', { name: /انتهت الحلقة/ }))
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.groups.all()[0].archived).toBe(true)
  })
})

describe('Today', () => {
  it("shows today's lessons in time order with the student's local time", () => {
    renderApp(
      '/',
      {
        students: [yusuf, omar],
        groups: [
          group({ id: 'late', studentIds: ['s1'], slots: [{ weekday: 5, time: '19:00' }] }),
          group({ id: 'early', studentIds: ['s2'], slots: [{ weekday: 5, time: '17:00' }] }),
          group({ id: 'tomorrow', studentIds: ['s1'], slots: [{ weekday: 6, time: '08:00' }] }),
        ],
      },
      { now: NOW },
    )
    const items = within(screen.getByRole('list', { name: 'حصص اليوم' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('عمر')
    expect(items[0]).toHaveTextContent('٥:٠٠ م')
    expect(items[0]).toHaveTextContent('٦:٠٠ م في السعودية')
    expect(items[1]).toHaveTextContent('يوسف')
  })

  it('marks the next lesson', () => {
    renderApp(
      '/',
      { students: [yusuf], groups: [group({ slots: [{ weekday: 5, time: '08:00' }, { weekday: 5, time: '17:00' }] })] },
      { now: NOW },
    )
    const items = within(screen.getByRole('list', { name: 'حصص اليوم' })).getAllByRole('listitem')
    expect(items[1]).toHaveTextContent('الحصة الجاية')
    expect(items[0]).not.toHaveTextContent('الحصة الجاية')
  })

  it('guides a new teacher to add students, then groups', () => {
    renderApp('/', {}, { now: NOW })
    expect(screen.getByRole('link', { name: 'أضف طلابك' })).toHaveAttribute('href', '/students/new')
  })
})

describe('Weekly schedule', () => {
  it('shows each day with its load and free times, and copies them for an academy', async () => {
    const { repos } = renderApp(
      '/groups',
      { students: [yusuf], groups: [group({ slots: [{ weekday: 6, time: '15:00' }], durationMin: 60 })] },
      { now: NOW },
    )
    await userEvent.click(screen.getByRole('tab', { name: 'الجدول الأسبوعي' }))
    const days = within(screen.getByRole('list', { name: 'أيام الأسبوع' })).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveTextContent('السبت')
    expect(days[0]).toHaveTextContent('١ حصة، ١ ساعة')
    expect(days[0]).toHaveTextContent('فاضي: ٢:٠٠ م – ٣:٠٠ م، ٤:٠٠ م – ١١:٠٠ م')

    fireEvent.change(screen.getByLabelText('بداية الشغل'), { target: { value: '16:00' } })
    expect(repos.profileNow().workHours).toEqual({ from: '16:00', to: '23:00' })

    const wa = screen.getByRole('link', { name: 'إرسال بواتساب' })
    expect(decodeURIComponent(wa.getAttribute('href')!)).toContain('مواعيدي الفاضية (بتوقيت مصر):')
  })
})
