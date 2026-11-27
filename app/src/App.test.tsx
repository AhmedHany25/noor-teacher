import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('shows the five main sections in the navigation', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'التنقل الرئيسي' })
    for (const label of ['اليوم', 'الطلاب', 'الحلقات', 'المستحقات', 'الإعدادات']) {
      expect(nav).toHaveTextContent(label)
    }
  })

  it('opens on the Today screen with an empty state', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'لا توجد حصص اليوم' })).toBeInTheDocument()
  })

  it('navigates to the students screen and marks the link active', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'الطلاب' }))
    expect(screen.getByRole('heading', { level: 1, name: 'الطلاب' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'الطلاب' })).toHaveClass('active')
  })
})
