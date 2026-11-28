import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Student } from '../../domain/student'
import { renderApp } from '../../test/renderApp'

const yusuf: Student = { id: 'y1', name: 'يوسف', academyId: null, status: 'active', createdAt: 1 }
// Friday 27 Nov 2026, 10:00.
const NOW = new Date(2026, 10, 27, 10, 0)

describe('Trial lesson', () => {
  it('opens from Today and books a one-off lesson for a new student that shows today only', async () => {
    const { repos } = renderApp('/', { students: [yusuf] }, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: 'حصة تجريبية جديدة' }))
    await userEvent.selectOptions(screen.getByLabelText('الطالب'), '+ طالب جديد')
    await userEvent.type(screen.getByLabelText('اسم الطالب الجديد'), 'مريم')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    const mariam = repos.students.all().find((s) => s.name === 'مريم')!
    expect(mariam).toMatchObject({ academyId: null, status: 'active' })
    expect(repos.groups.all()[0]).toMatchObject({
      studentIds: [mariam.id],
      slots: [],
      startDate: '2026-11-27',
      endDate: '2026-11-27',
      exceptions: { '2026-11-27': { type: 'extra', time: '11:00', kind: 'trial' } },
      trial: { paid: false },
    })
    const items = within(screen.getByRole('list', { name: 'حصص اليوم' })).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('مريم')
    expect(items[0]).toHaveTextContent('تجريبية')
  })

  it('books an existing student, marked as paid, and keeps it out of the weekly groups', async () => {
    const { repos } = renderApp('/trial/new', { students: [yusuf] }, { now: NOW })
    await userEvent.selectOptions(screen.getByLabelText('الطالب'), 'يوسف')
    await userEvent.click(screen.getByRole('checkbox', { name: /داخلة في المستحقات/ }))
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.groups.all()[0]).toMatchObject({ studentIds: ['y1'], trial: { paid: true } })
  })

  it('asks for the student first', async () => {
    const { repos } = renderApp('/trial/new', { students: [yusuf] }, { now: NOW })
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(screen.getByRole('alert')).toHaveTextContent('اختار الطالب.')
    expect(repos.groups.all()).toHaveLength(0)
  })
})
