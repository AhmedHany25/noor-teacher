import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from './test/renderApp'

const renderAt = (path: string, user?: null) => renderApp(path, {}, { user }).api

describe('App when signed out', () => {
  it('shows only the sign-in screen', () => {
    renderAt('/students', null)
    expect(screen.getByRole('button', { name: 'تسجيل الدخول بحساب جوجل' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('starts Google sign-in from the button', async () => {
    const api = renderAt('/', null)
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول بحساب جوجل' }))
    expect(api.signIn).toHaveBeenCalledOnce()
  })

  it('shows a clear error when sign-in fails', async () => {
    const api = renderAt('/', null)
    vi.mocked(api.signIn).mockRejectedValueOnce(new Error('network'))
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول بحساب جوجل' }))
    expect(screen.getByRole('alert')).toHaveTextContent('تعذّر تسجيل الدخول')
  })
})

describe('App when signed in', () => {
  it('shows the five main sections in the navigation', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'التنقل الرئيسي' })
    for (const label of ['اليوم', 'الطلاب', 'الحلقات', 'المستحقات', 'الإعدادات']) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('opens on the Today screen with an empty state', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'ابدأ بإضافة طلابك' })).toBeInTheDocument()
  })

  it('navigates to the students screen and marks the link active', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'الطلاب' }))
    expect(screen.getByRole('heading', { level: 1, name: 'الطلاب' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'الطلاب' })).toHaveClass('active')
  })

  it('shows the account in settings and signs out from there', async () => {
    const api = renderAt('/settings')
    expect(screen.getByRole('region', { name: 'الحساب' })).toHaveTextContent('teacher@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الخروج' }))
    expect(api.signOut).toHaveBeenCalledOnce()
  })
})
