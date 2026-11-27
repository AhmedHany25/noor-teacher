import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { encodePlan } from '../../domain/games'
import { renderApp } from '../../test/renderApp'
import raw from '../../../public/quran.txt?raw'

beforeAll(() => {
  vi.stubGlobal('fetch', async () => new Response(raw))
})

const code = encodePlan({ n: 'يوسف', p: [[78, 1, 20]], m: [[78, 9]] })

describe('Student games', () => {
  it('opens without signing in and plays «كمّل الآية» to the end', async () => {
    renderApp(`/play#${code}`, {}, { user: null })
    expect(screen.getByText('أهلًا يا يوسف')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /كمّل الآية/ }))
    for (let i = 0; i < 8; i++) {
      const game = screen.getByRole('region', { name: 'كمّل الآية' })
      const options = within(game).getAllByRole('button')
      expect(options).toHaveLength(3)
      await userEvent.click(options[0])
      await userEvent.click(screen.getByRole('button', { name: i === 7 ? 'النتيجة' : 'التالي' }))
    }
    const result = screen.getByRole('region', { name: 'النتيجة' })
    expect(result).toHaveTextContent(/من ٨ سؤال/)
    const share = within(result).getByRole('link', { name: 'ابعت النتيجة للشيخ' })
    expect(decodeURIComponent(share.getAttribute('href')!)).toContain('يوسف لعب «كمّل الآية»')
  })

  it('puts the words of an ayah back in order', async () => {
    renderApp(`/play#${code}`, {}, { user: null })
    await userEvent.click(await screen.findByRole('button', { name: /رتّب الكلمات/ }))
    const game = screen.getByRole('region', { name: 'رتّب الكلمات' })
    const chips = within(game).getAllByRole('button')
    expect(chips.length).toBeGreaterThanOrEqual(3)
    expect(within(game).getByLabelText('الكلمات اللي رتبتها')).toHaveTextContent('…')
  })

  it('explains a broken link', () => {
    renderApp('/play#broken', {}, { user: null })
    expect(screen.getByText(/اللينك ده مش شغال/)).toBeInTheDocument()
  })
})
