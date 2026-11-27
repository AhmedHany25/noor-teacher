import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Academy } from '../../domain/academy'
import { renderApp } from '../../test/renderApp'

const furqan: Academy = { id: 'a1', name: 'الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }

describe('Academies', () => {
  it('invites adding the first academy', () => {
    renderApp('/academies')
    expect(screen.getByRole('heading', { name: 'أضف الأكاديميات اللي بتشتغل معاها' })).toBeInTheDocument()
  })

  it('lists academies with their rate and number of active students', () => {
    renderApp('/academies', {
      academies: [furqan],
      students: [
        { id: 's1', name: 'يوسف', academyId: 'a1', status: 'active', createdAt: 1 },
        { id: 's2', name: 'عمر', academyId: 'a1', status: 'left', createdAt: 1 },
      ],
    })
    const row = within(screen.getByRole('list', { name: 'الأكاديميات' })).getByRole('listitem')
    expect(row).toHaveTextContent('الفرقان')
    expect(row).toHaveTextContent('٤٠ ريال بالحصة')
    expect(row).toHaveTextContent('١ طالب')
  })

  it('adds an academy', async () => {
    const { repos } = renderApp('/academies')
    await userEvent.click(screen.getByRole('link', { name: 'إضافة أكاديمية' }))
    await userEvent.type(screen.getByLabelText('الاسم'), 'دار الهدى')
    await userEvent.clear(screen.getByLabelText('العملة'))
    await userEvent.type(screen.getByLabelText('العملة'), 'دولار')
    await userEvent.click(screen.getByRole('radio', { name: 'بالساعة' }))
    await userEvent.type(screen.getByLabelText('السعر'), '8')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.academies.all()).toMatchObject([
      { name: 'دار الهدى', currency: 'دولار', payMode: 'hour', rate: 8, archived: false },
    ])
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ الأكاديمية')
  })

  it('edits and archives an academy', async () => {
    const { repos } = renderApp('/academies/a1', { academies: [furqan] })
    expect(screen.getByLabelText('الاسم')).toHaveValue('الفرقان')
    await userEvent.click(screen.getByRole('checkbox', { name: /توقفت عن العمل معها/ }))
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.academies.all()[0]).toMatchObject({ name: 'الفرقان', archived: true })
  })

  it('makes a new academy available as a payer in the student form', async () => {
    renderApp('/students/new', { academies: [furqan] })
    expect(screen.getByRole('option', { name: 'الفرقان' })).toBeInTheDocument()
  })
})
