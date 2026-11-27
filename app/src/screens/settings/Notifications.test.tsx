import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DataProvider } from '../../data/DataProvider'
import { memoryRepos } from '../../data/memoryRepos'
import { NotificationsSection, type PushApi } from './NotificationsSection'

function setup(push: Partial<PushApi> = {}) {
  const repos = memoryRepos()
  const api: PushApi = {
    supported: () => true,
    enable: vi.fn(async () => 'token-123'),
    test: vi.fn(async () => {}),
    label: () => 'Android، Chrome',
    ...push,
  }
  render(
    <DataProvider repos={repos}>
      <NotificationsSection push={api} />
    </DataProvider>,
  )
  return { repos, api }
}

beforeEach(() => localStorage.clear())

describe('Notification settings', () => {
  it('registers this device and saves the default reminder choices', async () => {
    const { repos } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'تفعيل الإشعارات على الجهاز ده' }))
    expect(repos.devices.all()).toMatchObject([{ id: 'token-123', token: 'token-123', label: 'Android، Chrome' }])
    expect(repos.profileNow().notify).toMatchObject({ beforeOn: true, beforeMinutes: 15, eodOn: true, eodTime: '21:00', morningOn: false })
    expect(screen.getByText(/مفعّلة على الجهاز ده/)).toBeInTheDocument()
  })

  it('explains why it could not be enabled', async () => {
    setup({ enable: async () => Promise.reject(new Error('الإشعارات مقفولة. افتحها من إعدادات المتصفح للموقع ده.')) })
    await userEvent.click(screen.getByRole('button', { name: 'تفعيل الإشعارات على الجهاز ده' }))
    expect(screen.getByRole('alert')).toHaveTextContent('الإشعارات مقفولة')
  })

  it('changes reminder choices', async () => {
    const { repos } = setup()
    await userEvent.selectOptions(screen.getByLabelText('قبل الحصة بـ'), '30')
    await userEvent.click(screen.getByRole('checkbox', { name: 'ملخص الصبح بحصص اليوم' }))
    expect(repos.profileNow().notify).toMatchObject({ beforeMinutes: 30, morningOn: true })
  })

  it('tells the teacher when the browser cannot do notifications', () => {
    setup({ supported: () => false })
    expect(screen.getByText(/المتصفح ده مش بيدعم الإشعارات/)).toBeInTheDocument()
  })
})
