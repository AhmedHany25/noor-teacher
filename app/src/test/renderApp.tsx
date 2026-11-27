import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { App } from '../App'
import type { AuthApi, AuthUser } from '../auth/auth'
import { AuthProvider } from '../auth/AuthProvider'
import { memoryRepos } from '../data/memoryRepos'

export const teacher: AuthUser = { uid: 'u1', name: 'أحمد', email: 'teacher@example.com', photoUrl: null }

/** Renders the whole app at `path`, signed in (or not), on in-memory data. */
export function renderApp(
  path: string,
  seed: Parameters<typeof memoryRepos>[0] = {},
  opts: { user?: AuthUser | null; now?: Date } = {},
) {
  const repos = memoryRepos(seed)
  const makeRepos = () => repos
  let emit: (u: AuthUser | null) => void = () => {}
  const api: AuthApi = {
    onChange: (cb) => {
      emit = cb
      return () => {}
    },
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
  render(
    <AuthProvider api={api}>
      <MemoryRouter initialEntries={[path]}>
        <App makeRepos={makeRepos} now={opts.now} timeZone="Africa/Cairo" />
      </MemoryRouter>
    </AuthProvider>,
  )
  act(() => emit(opts.user === undefined ? teacher : opts.user))
  return { repos, api }
}
