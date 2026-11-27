import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { NotificationEntry } from '../data/repos'
import { renderApp } from '../test/renderApp'

const NOW = new Date(2026, 10, 27, 12, 0)
const notes: NotificationEntry[] = [
  { id: 'before:g1:2026-11-27:17:00', date: '2026-11-27', at: NOW.getTime() - 5 * 60_000, title: 'حصة عمر بعد ١٥ دقيقة', body: 'الساعة ٥:٠٠ م، ٣٠ دقيقة', url: '/lessons/g1/2026-11-27' },
  { id: 'eod:2026-11-26', date: '2026-11-26', at: NOW.getTime() - 26 * 3_600_000, title: 'فاضل حصتين النهارده متسجلتش', url: '/' },
]

describe('Navigation', () => {
  it('has the five phone items with «المزيد», and the full list for the desktop rail', () => {
    renderApp('/', {}, { now: NOW })
    const nav = screen.getByRole('navigation', { name: 'التنقل الرئيسي' })
    for (const label of ['اليوم', 'الحضور', 'الطلاب', 'الحلقات', 'المستحقات', 'التقارير', 'الإعدادات', 'المزيد']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'الحلقات' })).toHaveClass('rail-only')
    expect(within(nav).getByRole('link', { name: 'المزيد' })).toHaveClass('mobile-only')
  })

  it('lists the other sections under «المزيد»', async () => {
    renderApp('/', {}, { now: NOW })
    await userEvent.click(screen.getByRole('link', { name: 'المزيد' }))
    expect(screen.getByRole('heading', { level: 1, name: 'المزيد' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /الحلقات.*الجدول الأسبوعي/ })).toHaveAttribute('href', '/groups')
  })
})

describe('Bell', () => {
  it('counts unread notifications and lists them with how long ago', async () => {
    const { repos } = renderApp('/', { notifications: notes, profile: { notifySeenAt: NOW.getTime() - 3_600_000 } }, { now: NOW })
    const bell = screen.getByRole('link', { name: 'الإشعارات، ١ جديدة' })
    await userEvent.click(bell)

    const list = within(screen.getByRole('list', { name: 'الإشعارات' })).getAllByRole('listitem')
    expect(list[0]).toHaveTextContent('حصة عمر بعد ١٥ دقيقة')
    expect(list[0]).toHaveTextContent('من ٥ دقائق')
    expect(list[0]).toHaveClass('is-new')
    expect(list[1]).toHaveTextContent('امبارح')
    expect(list[1]).not.toHaveClass('is-new')
    expect(within(list[0]).getByRole('link')).toHaveAttribute('href', '/lessons/g1/2026-11-27')
    // Opening the page marks everything read.
    expect(repos.profileNow().notifySeenAt).toBeGreaterThan(NOW.getTime() - 60_000)
  })

  it('invites turning reminders on when there are none', async () => {
    renderApp('/notifications', {}, { now: NOW })
    expect(screen.getByRole('heading', { name: 'مفيش إشعارات لسه' })).toBeInTheDocument()
  })
})
