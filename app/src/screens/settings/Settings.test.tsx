import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../../test/renderApp'

const oldBackup = {
  app: 'noor-teacher',
  v: 1,
  db: {
    settings: { currency: 'جنيه' },
    academies: [{ id: 'A1', name: 'الفرقان' }],
    students: [
      { id: 'S1', name: 'يوسف', academy: 'A1', mode: 'session', rate: 40 },
      { id: 'S2', name: 'سارة', academy: '', mode: 'month', rate: 600 },
    ],
    groups: [{ id: 'G1', students: ['S1'], date: '2026-10-02', time: '17:00', dur: 30, repeat: 'weekly', days: ['5'] }],
    attendance: { 'G1|2026-10-02': { st: { S1: 'p' } } },
    plans: [{ id: 'P1' }],
  },
}

const file = (content: string, name = 'backup.json') => new File([content], name, { type: 'application/json' })

describe('Import from the old site', () => {
  it('shows a summary first and imports only after confirming', async () => {
    const { repos } = renderApp('/settings')
    await userEvent.upload(screen.getByLabelText('اختيار ملف النسخة الاحتياطية'), file(JSON.stringify(oldBackup)))

    const summary = await screen.findByRole('region', { name: 'ملخص الاستيراد' })
    expect(summary).toHaveTextContent('٢ طالب')
    expect(summary).toHaveTextContent('١ حلقة')
    expect(summary).toHaveTextContent('١ حصة مسجلة')
    expect(repos.students.all()).toHaveLength(0)

    await userEvent.click(within(summary).getByRole('button', { name: 'استيراد' }))
    expect(repos.students.all().map((s) => s.name).sort()).toEqual(['سارة', 'يوسف'])
    expect(repos.sessions.all()).toHaveLength(1)
    expect(await repos.loadLegacy()).toHaveProperty('plans')
    expect(screen.getByRole('status')).toHaveTextContent('تم استيراد البيانات')
    expect(screen.queryByRole('region', { name: 'ملخص الاستيراد' })).not.toBeInTheDocument()
  })

  it('can be cancelled', async () => {
    const { repos } = renderApp('/settings')
    await userEvent.upload(screen.getByLabelText('اختيار ملف النسخة الاحتياطية'), file(JSON.stringify(oldBackup)))
    await userEvent.click(await screen.findByRole('button', { name: 'إلغاء' }))
    expect(screen.queryByRole('region', { name: 'ملخص الاستيراد' })).not.toBeInTheDocument()
    expect(repos.students.all()).toHaveLength(0)
  })

  it('explains a wrong file', async () => {
    renderApp('/settings')
    await userEvent.upload(screen.getByLabelText('اختيار ملف النسخة الاحتياطية'), file('hello'))
    expect(await screen.findByRole('alert')).toHaveTextContent('الملف مش JSON صالح.')
  })

  it('warns when the app already has students', async () => {
    renderApp('/settings', { students: [{ id: 'x', name: 'موجود', academyId: null, status: 'active', createdAt: 1 }] })
    await userEvent.upload(screen.getByLabelText('اختيار ملف النسخة الاحتياطية'), file(JSON.stringify(oldBackup)))
    expect(await screen.findByRole('region', { name: 'ملخص الاستيراد' })).toHaveTextContent('ممكن يتكرروا')
  })
})

describe('Backup', () => {
  it('offers downloading a full backup', async () => {
    renderApp('/settings')
    await waitFor(() => expect(screen.getByRole('button', { name: 'تنزيل نسخة احتياطية' })).toBeEnabled())
  })
})

describe('Appearance', () => {
  it('switches between auto, light and dark and remembers the choice', async () => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    renderApp('/settings')
    expect(screen.getByRole('radio', { name: 'تلقائي' })).toBeChecked()

    await userEvent.click(screen.getByRole('radio', { name: 'ليلي' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('noor-theme')).toBe('dark')

    await userEvent.click(screen.getByRole('radio', { name: 'فاتح' }))
    expect(document.documentElement.dataset.theme).toBe('light')

    await userEvent.click(screen.getByRole('radio', { name: 'تلقائي' }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('noor-theme')).toBeNull()
  })
})
