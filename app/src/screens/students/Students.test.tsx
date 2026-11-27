import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'
import type { Academy } from '../../domain/academy'
import type { Student } from '../../domain/student'

const academy: Academy = { id: 'a1', name: 'أكاديمية الفرقان', currency: 'ريال', payMode: 'session', rate: 40, archived: false }

const stu = (over: Partial<Student>): Student => ({
  id: over.name ?? 'x',
  name: 'x',
  academyId: null,
  status: 'active',
  createdAt: 1,
  ...over,
})

describe('Students list', () => {
  it('invites adding the first student when there are none', () => {
    renderApp('/students')
    expect(screen.getByRole('heading', { name: 'أضف أول طالب' })).toBeInTheDocument()
  })

  it('lists active students by name with their payer, and counts per status', () => {
    renderApp('/students', {
      academies: [academy],
      students: [
        stu({ name: 'يوسف', academyId: 'a1' }),
        stu({ name: 'آمنة' }),
        stu({ name: 'عمر', status: 'paused' }),
      ],
    })
    const list = screen.getByRole('list', { name: 'قائمة الطلاب' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((li) => li.querySelector('.stu-name')?.textContent)).toEqual(['آمنة', 'يوسف'])
    expect(items[1]).toHaveTextContent('أكاديمية الفرقان')
    expect(items[0]).toHaveTextContent('خصوصي')
    expect(screen.getByRole('tab', { name: /نشط/ })).toHaveTextContent('٢')
    expect(screen.getByRole('tab', { name: /موقوف/ })).toHaveTextContent('١')
  })

  it('switches status tabs and searches ignoring hamza', async () => {
    renderApp('/students', {
      students: [stu({ name: 'إبراهيم', status: 'paused' }), stu({ name: 'عمر', status: 'paused' })],
    })
    await userEvent.click(screen.getByRole('tab', { name: /موقوف/ }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'ابحث بالاسم' }), 'ابراهيم')
    const items = within(screen.getByRole('list', { name: 'قائمة الطلاب' })).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('إبراهيم')
  })

  it('links to WhatsApp with the international number', () => {
    renderApp('/students', { students: [stu({ name: 'يوسف', guardianPhone: '01012345678' })] })
    expect(screen.getByRole('link', { name: 'واتساب ولي أمر يوسف' })).toHaveAttribute(
      'href',
      'https://wa.me/201012345678',
    )
  })
})

describe('Student form', () => {
  it('adds a student and returns to the list', async () => {
    const { repos } = renderApp('/students', { academies: [academy] })
    await userEvent.click(screen.getByRole('link', { name: 'إضافة طالب' }))
    await userEvent.type(screen.getByLabelText('الاسم'), 'يوسف محمود')
    await userEvent.type(screen.getByLabelText('واتساب ولي الأمر'), '01012345678')
    await userEvent.selectOptions(screen.getByLabelText('جهة الدفع'), 'a1')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    expect(repos.students.all()).toMatchObject([
      { name: 'يوسف محمود', guardianPhone: '01012345678', academyId: 'a1', status: 'active' },
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'الطلاب' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('تم حفظ الطالب')
  })

  it('shows field errors and does not save an invalid student', async () => {
    const { repos } = renderApp('/students/new')
    await userEvent.type(screen.getByLabelText('واتساب ولي الأمر'), '12')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(screen.getByText('اكتب اسم الطالب.')).toBeInTheDocument()
    expect(screen.getByText(/الرقم قصير/)).toBeInTheDocument()
    expect(repos.students.all()).toHaveLength(0)
  })

  it('edits an existing student, including changing status and clearing a field', async () => {
    const { repos } = renderApp('/students', { students: [stu({ name: 'عمر', level: 'جزء عم' })] })
    await userEvent.click(screen.getByRole('link', { name: /عمر/ }))
    expect(screen.getByLabelText('الاسم')).toHaveValue('عمر')
    await userEvent.clear(screen.getByLabelText('المستوى'))
    await userEvent.click(screen.getByRole('radio', { name: 'موقوف' }))
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.students.all()[0]).toMatchObject({ name: 'عمر', status: 'paused' })
    expect(repos.students.all()[0].level).toBeUndefined()
  })

  it('saves a special rate only when one is entered', async () => {
    const { repos } = renderApp('/students/new')
    await userEvent.type(screen.getByLabelText('الاسم'), 'سارة')
    await userEvent.selectOptions(screen.getByLabelText('طريقة الحساب'), 'hour')
    await userEvent.type(screen.getByLabelText('السعر'), '120')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))
    expect(repos.students.all()[0]).toMatchObject({ name: 'سارة', payMode: 'hour', rate: 120 })
  })
})
